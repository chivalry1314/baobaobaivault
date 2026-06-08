package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"sync"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/baobaobai/baobaobaivault/internal/storage"
	webpushsvc "github.com/baobaobai/baobaobaivault/internal/webpush"
	authpkg "github.com/baobaobai/baobaobaivault/pkg/auth"
	"github.com/gin-gonic/gin"
	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Handler struct {
	cfg              *config.Config
	db               *gorm.DB
	redis            *goredis.Client
	logger           *zap.Logger
	userService      *service.UserService
	roleService      *service.RoleService
	namespaceService *service.NamespaceService
	storageService   *service.StorageService
	baiduService     *service.BaiduConnectorService
	registry         *storage.Registry
	shareService     *service.ShareService
	shareSMTPTestMu  sync.Mutex
	shareSMTPTestAt  map[string]time.Time

	webPushRepo    *webpushsvc.Repository
	webPushQueue   *webpushsvc.Queue
	webPushService *webpushsvc.Service
}

func NewRouter(cfg *config.Config, db *gorm.DB, rdb *goredis.Client, logger *zap.Logger) *gin.Engine {
	switch strings.ToLower(cfg.Server.Mode) {
	case "release":
		gin.SetMode(gin.ReleaseMode)
	case "test":
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}

	registry := storage.NewRegistry()
	emailService := service.NewEmailService(cfg.Email)
	h := &Handler{
		cfg:              cfg,
		db:               db,
		redis:            rdb,
		logger:           logger,
		userService:      service.NewUserService(db, logger, cfg.JWT.Secret),
		roleService:      service.NewRoleService(db, logger),
		namespaceService: service.NewNamespaceService(db, logger),
		storageService:   service.NewStorageService(db, logger, registry),
		baiduService:     service.NewBaiduConnectorService(db, logger, cfg.Baidu, cfg.JWT.Secret),
		registry:         registry,
		shareService:     service.NewShareService(db, logger, filepath.Join("storage", "share", "files"), cfg.ShareAuth, emailService, cfg.Server.AdminEmail),
		shareSMTPTestAt:  make(map[string]time.Time),
	}

	if _, err := h.roleService.EnsureDefaultAdminRole(context.Background()); err != nil {
		logger.Warn("failed to ensure admin role", zap.Error(err))
	}
	if err := h.autoBootstrapAdmin(context.Background()); err != nil {
		logger.Warn("failed to auto bootstrap admin user", zap.Error(err))
	}

	if cfg.WebPush.Enabled {
		vapidPublic := strings.TrimSpace(cfg.WebPush.VAPIDPublicKey)
		vapidPrivate := strings.TrimSpace(cfg.WebPush.VAPIDPrivateKey)
		if (vapidPublic == "" || vapidPrivate == "") && cfg.WebPush.AllowVAPIDAutoGen {
			publicKey, privateKey, err := webpushsvc.GenerateVAPIDKeys()
			if err != nil {
				logger.Warn("failed to auto-generate VAPID keys", zap.Error(err))
			} else {
				vapidPublic = publicKey
				vapidPrivate = privateKey
				cfg.WebPush.VAPIDPublicKey = publicKey
				cfg.WebPush.VAPIDPrivateKey = privateKey
				logger.Warn("auto-generated VAPID keys for this process; configure persistent keys for production")
			}
		}

		h.webPushRepo = webpushsvc.NewRepository(db, logger)
		h.webPushQueue = webpushsvc.NewQueue(cfg.WebPush.QueueConcurrency, cfg.WebPush.QueueBuffer)
		h.webPushService = webpushsvc.NewService(webpushsvc.ServiceOptions{
			VAPIDSubject:    cfg.WebPush.VAPIDSubject,
			VAPIDPublicKey:  vapidPublic,
			VAPIDPrivateKey: vapidPrivate,
			DefaultTTL:      cfg.WebPush.DefaultTTLSeconds,
			PushProxyURL:    cfg.WebPush.PushProxyURL,
		}, h.webPushRepo, logger)
	}

	authMiddleware := NewAuthMiddleware(db, h.userService)

	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())
	if cfg.Cors.Enabled {
		r.Use(newCORSMiddleware(cfg.Cors))
	}

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().UTC().Format(time.RFC3339)})
	})

	if cfg.WebPush.Enabled && cfg.WebPush.PublicAPIEnabled {
		apiGroup := r.Group("/api")
		h.registerWebPushPublicRoutes(apiGroup)
	}

	h.registerShareRoutes(r)

	v1 := r.Group("/api/v1")
	{
		v1.POST("/auth/login", h.login)
		v1.GET("/connectors/baidu/callback", h.baiduOAuthCallback)
		if cfg.Server.AllowPublicBootstrap {
			v1.POST("/bootstrap/admin", h.bootstrapAdmin)
		} else {
			v1.POST("/bootstrap/admin", h.bootstrapAdminDisabled)
		}

		authed := v1.Group("")
		authed.Use(authMiddleware.RequireAuth(), h.auditLogMiddleware())
		{
			authed.GET("/connectors/baidu/status", h.getBaiduConnectorStatus)
			authed.GET("/connectors/baidu/auth-url", h.getBaiduConnectorAuthURL)
			authed.GET("/connectors/baidu/backups", h.listBaiduBackups)
			authed.POST("/connectors/baidu/backup", h.uploadBaiduBackup)
			authed.GET("/connectors/baidu/download", h.downloadBaiduBackup)
			authed.DELETE("/connectors/baidu/backup", h.deleteBaiduBackup)
			authed.POST("/connectors/baidu/disconnect", h.disconnectBaiduConnector)

			authed.POST("/auth/aksk", h.createAKSK)
			authed.GET("/auth/aksk", h.listAKSK)
			authed.DELETE("/auth/aksk/:id", h.revokeAKSK)
			authed.PUT("/users/me/password", h.changePassword)

			authed.GET("/users", authMiddleware.RequirePermission("user", "list"), h.listUsers)
			authed.GET("/users/:id", authMiddleware.RequirePermission("user", "read"), h.getUser)
			authed.POST("/users", authMiddleware.RequirePermission("user", "create"), h.createUser)
			authed.PUT("/users/:id", authMiddleware.RequirePermission("user", "update"), h.updateUser)
			authed.DELETE("/users/:id", authMiddleware.RequirePermission("user", "delete"), h.deleteUser)

			authed.GET("/permissions", authMiddleware.RequirePermission("user", "list"), h.listPermissions)
			authed.GET("/roles", authMiddleware.RequirePermission("user", "list"), h.listRoles)
			authed.POST("/roles", authMiddleware.RequirePermission("user", "update"), h.createRole)
			authed.PUT("/roles/:id", authMiddleware.RequirePermission("user", "update"), h.updateRole)
			authed.DELETE("/roles/:id", authMiddleware.RequirePermission("user", "delete"), h.deleteRole)

			authed.GET("/namespaces", authMiddleware.RequirePermission("namespace", "list"), h.listNamespaces)
			authed.GET("/namespaces/:id", authMiddleware.RequirePermission("namespace", "read"), h.getNamespace)
			authed.POST("/namespaces", authMiddleware.RequirePermission("namespace", "create"), h.createNamespace)
			authed.PUT("/namespaces/:id", authMiddleware.RequirePermission("namespace", "update"), h.updateNamespace)
			authed.DELETE("/namespaces/:id", authMiddleware.RequirePermission("namespace", "delete"), h.deleteNamespace)

			authed.GET("/storage/configs", authMiddleware.RequirePermission("storage", "list"), h.listStorageConfigs)
			authed.POST("/storage/configs", authMiddleware.RequirePermission("storage", "create"), h.createStorageConfig)
			authed.DELETE("/storage/configs/:id", authMiddleware.RequirePermission("storage", "delete"), h.deleteStorageConfig)

			authed.GET("/storage/objects", authMiddleware.RequirePermission("object", "list"), h.listObjects)
			authed.GET("/storage/objects/versions", authMiddleware.RequirePermission("object", "read"), h.listObjectVersions)
			authed.POST("/storage/objects/versions/rollback", authMiddleware.RequirePermission("object", "create"), h.rollbackObjectVersion)
			authed.POST("/storage/objects/upload", authMiddleware.RequirePermission("object", "create"), h.uploadObject)
			authed.GET("/storage/objects/download", authMiddleware.RequirePermission("object", "read"), h.downloadObject)
			authed.DELETE("/storage/objects", authMiddleware.RequirePermission("object", "delete"), h.deleteObject)
			authed.GET("/storage/objects/presign-put", authMiddleware.RequirePermission("object", "create"), h.presignPutObject)
			authed.POST("/storage/objects/presign-put/complete", authMiddleware.RequirePermission("object", "create"), h.completePresignPutObject)
			authed.GET("/storage/objects/presign-get", authMiddleware.RequirePermission("object", "share"), h.presignGetObject)

			authed.GET("/audit/logs", authMiddleware.RequirePermission("audit", "read"), h.listAuditLogs)
		}
	}

	return r
}

func (h *Handler) login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	resp, err := h.userService.LoginWithEmail(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}
	jsonSuccess(c, resp)
}

func (h *Handler) bootstrapAdminDisabled(c *gin.Context) {
	jsonError(c, http.StatusForbidden, errors.New("public admin bootstrap is disabled"))
}

type bootstrapAdminRequest struct {
	Admin struct {
		Username string `json:"username"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Nickname string `json:"nickname"`
	} `json:"admin" binding:"required"`
}

func (h *Handler) bootstrapAdmin(c *gin.Context) {
	var req bootstrapAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var adminCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("roles.code = ?", model.RoleCodeAdmin).
		Count(&adminCount).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	if adminCount > 0 {
		jsonError(c, http.StatusForbidden, errors.New("admin already exists"))
		return
	}

	role, err := h.roleService.EnsureDefaultAdminRole(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), &service.CreateUserRequest{
		Username: req.Admin.Username,
		Email:    req.Admin.Email,
		Password: req.Admin.Password,
		Nickname: req.Admin.Nickname,
		RoleIDs:  []string{role.ID},
	})
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	loginResp, err := h.userService.Login(c.Request.Context(), req.Admin.Email, req.Admin.Password)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	jsonCreated(c, gin.H{"admin_user": user, "auth": loginResp})
}

func (h *Handler) autoBootstrapAdmin(ctx context.Context) error {
	if h.cfg == nil || !h.cfg.Server.AutoBootstrapAdmin {
		return nil
	}

	email := strings.ToLower(strings.TrimSpace(h.cfg.Server.AdminEmail))
	password := strings.TrimSpace(h.cfg.Server.AdminPassword)
	username := strings.TrimSpace(h.cfg.Server.AdminUsername)
	nickname := strings.TrimSpace(h.cfg.Server.AdminNickname)

	missing := make([]string, 0, 2)
	if email == "" {
		missing = append(missing, "server.admin_email")
	}
	if password == "" {
		missing = append(missing, "server.admin_password")
	}
	if len(missing) > 0 {
		return fmt.Errorf("auto bootstrap admin is enabled but missing config: %s", strings.Join(missing, ", "))
	}
	if len(password) < 6 {
		return errors.New("server.admin_password must be at least 6 characters")
	}

	role, err := h.roleService.EnsureDefaultAdminRole(ctx)
	if err != nil {
		return err
	}

	var user model.User
	err = h.db.WithContext(ctx).First(&user, "lower(email) = ?", email).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err == nil {
		var roleBindingCount int64
		if err := h.db.WithContext(ctx).
			Table("user_roles").
			Where("user_id = ? AND role_id = ?", user.ID, role.ID).
			Count(&roleBindingCount).Error; err != nil {
			return err
		}
		if roleBindingCount == 0 {
			if err := h.db.WithContext(ctx).Model(&user).Association("Roles").Append(role); err != nil {
				return err
			}
			h.logger.Info("bound admin role to existing configured user",
				zap.String("user_id", user.ID),
				zap.String("email", email),
			)
		}
		return nil
	}

	var adminCount int64
	if err := h.db.WithContext(ctx).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("roles.code = ?", model.RoleCodeAdmin).
		Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount > 0 {
		h.logger.Info("admin already exists, skip auto bootstrap", zap.Int64("existing_count", adminCount))
		return nil
	}

	created, err := h.userService.CreateUser(ctx, &service.CreateUserRequest{
		Username: username,
		Email:    email,
		Password: password,
		Nickname: nickname,
		RoleIDs:  []string{role.ID},
	})
	if err != nil {
		return err
	}

	h.logger.Info("auto bootstrapped admin user",
		zap.String("user_id", created.ID),
		zap.String("email", created.Email),
	)
	return nil
}

func (h *Handler) createUser(c *gin.Context) {
	var req service.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureAssignableRoles(c, req.RoleIDs, string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, user)
}

func (h *Handler) getUser(c *gin.Context) {
	user, err := h.userService.GetUser(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	if err := h.ensureUserActionAllowed(c, user.ID, string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	jsonSuccess(c, user)
}

func (h *Handler) listUsers(c *gin.Context) {
	page, pageSize := parsePage(c)
	req := &service.ListUserRequest{
		Page:     page,
		PageSize: pageSize,
		Status:   strings.TrimSpace(c.Query("status")),
		Keyword:  strings.TrimSpace(c.Query("keyword")),
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "user", string(model.ActionList))
	if err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if !unrestricted {
		req.VisibleNamespaceIDs = namespaceIDSetToSlice(scope)
		req.CurrentUserID = getUserID(c)
		req.ScopeFiltered = true
	}

	items, total, err := h.userService.ListUsers(c.Request.Context(), req)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) updateUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("user id is required"))
		return
	}
	if err := h.ensureUserActionAllowed(c, userID, string(model.ActionUpdate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	before, err := h.userService.GetUser(c.Request.Context(), userID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	var req service.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if req.RoleIDs != nil {
		if err := h.ensureAssignableRoles(c, req.RoleIDs, string(model.ActionUpdate)); err != nil {
			jsonError(c, http.StatusForbidden, err)
			return
		}
	}

	user, err := h.userService.UpdateUser(c.Request.Context(), userID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, before, user)
	jsonSuccess(c, user)
}

func (h *Handler) deleteUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("user id is required"))
		return
	}
	if err := h.ensureUserActionAllowed(c, userID, string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	if err := h.userService.DeleteUser(c.Request.Context(), userID); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) listPermissions(c *gin.Context) {
	items, err := h.roleService.ListPermissions(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) listRoles(c *gin.Context) {
	items, err := h.roleService.ListRoles(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) createRole(c *gin.Context) {
	var req service.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureRoleMutationAllowed(
		c,
		"",
		string(model.ActionCreate),
		req.Level,
		req.PermissionIDs,
		req.NamespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	role, err := h.roleService.CreateRole(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, role)
}

func (h *Handler) updateRole(c *gin.Context) {
	roleID := c.Param("id")
	current, err := h.roleService.GetRole(c.Request.Context(), roleID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	var req service.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	targetLevel := current.Level
	if req.Level != nil {
		targetLevel = *req.Level
	}
	permissionIDs := make([]string, 0, len(current.Permissions))
	if req.PermissionIDs != nil {
		permissionIDs = append(permissionIDs, *req.PermissionIDs...)
	} else {
		for _, item := range current.Permissions {
			permissionIDs = append(permissionIDs, item.ID)
		}
	}
	namespaceIDs := make([]string, 0, len(current.Namespaces))
	if req.NamespaceIDs != nil {
		namespaceIDs = append(namespaceIDs, *req.NamespaceIDs...)
	} else {
		for _, item := range current.Namespaces {
			namespaceIDs = append(namespaceIDs, item.ID)
		}
	}

	if err := h.ensureRoleMutationAllowed(
		c,
		roleID,
		string(model.ActionUpdate),
		targetLevel,
		permissionIDs,
		namespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	role, err := h.roleService.UpdateRole(c.Request.Context(), roleID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, current, role)
	jsonSuccess(c, role)
}

func (h *Handler) deleteRole(c *gin.Context) {
	roleID := c.Param("id")
	current, err := h.roleService.GetRole(c.Request.Context(), roleID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	permissionIDs := make([]string, 0, len(current.Permissions))
	for _, item := range current.Permissions {
		permissionIDs = append(permissionIDs, item.ID)
	}
	namespaceIDs := make([]string, 0, len(current.Namespaces))
	for _, item := range current.Namespaces {
		namespaceIDs = append(namespaceIDs, item.ID)
	}
	if err := h.ensureRoleMutationAllowed(
		c,
		roleID,
		string(model.ActionDelete),
		current.Level,
		permissionIDs,
		namespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	if err := h.roleService.DeleteRole(c.Request.Context(), roleID); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) changePassword(c *gin.Context) {
	var req service.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.userService.ChangePassword(c.Request.Context(), getUserID(c), req.OldPassword, req.NewPassword); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"updated": true})
}

func (h *Handler) createNamespace(c *gin.Context) {
	var req service.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureNamespaceOwnerExists(c.Request.Context(), req.OwnerUserID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	ns, err := h.namespaceService.CreateNamespace(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, ns)
}

func (h *Handler) getNamespace(c *gin.Context) {
	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "namespace", string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	jsonSuccess(c, ns)
}

func (h *Handler) listNamespaces(c *gin.Context) {
	page, pageSize := parsePage(c)
	req := &service.ListNamespaceRequest{
		Page:     page,
		PageSize: pageSize,
		Status:   strings.TrimSpace(c.Query("status")),
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "namespace", string(model.ActionList))
	if err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if !unrestricted {
		req.NamespaceIDs = namespaceIDSetToSlice(scope)
	}

	items, total, err := h.namespaceService.ListNamespaces(c.Request.Context(), req)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) updateNamespace(c *gin.Context) {
	namespaceID := c.Param("id")
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace id is required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "namespace", string(model.ActionUpdate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	before, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	var req service.UpdateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if req.OwnerUserID != nil {
		if err := h.ensureNamespaceOwnerExists(c.Request.Context(), *req.OwnerUserID); err != nil {
			jsonError(c, http.StatusBadRequest, err)
			return
		}
	}

	ns, err := h.namespaceService.UpdateNamespace(c.Request.Context(), namespaceID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, before, ns)
	jsonSuccess(c, ns)
}

func (h *Handler) deleteNamespace(c *gin.Context) {
	namespaceID := c.Param("id")
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace id is required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "namespace", string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	if err := h.namespaceService.DeleteNamespace(c.Request.Context(), namespaceID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) createStorageConfig(c *gin.Context) {
	var req service.CreateStorageConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureNamespaceOwnerExists(c.Request.Context(), req.OwnerUserID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	cfg, err := h.storageService.CreateStorageConfig(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, cfg)
}

func (h *Handler) listStorageConfigs(c *gin.Context) {
	items, err := h.storageService.ListStorageConfigs(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) deleteStorageConfig(c *gin.Context) {
	if err := h.storageService.DeleteStorageConfig(c.Request.Context(), c.Param("id")); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) uploadObject(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.PostForm("namespace_id"))
	key := strings.TrimSpace(c.PostForm("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		jsonError(c, http.StatusBadRequest, errors.New("file is required"))
		return
	}
	defer file.Close()

	contentType := strings.TrimSpace(c.PostForm("content_type"))
	if contentType == "" {
		contentType = strings.TrimSpace(header.Header.Get("Content-Type"))
	}

	metadata := parseMetadata(c.PostForm("metadata"))
	object, err := h.storageService.PutObject(
		c.Request.Context(),
		namespaceID,
		key,
		file,
		header.Size,
		contentType,
		metadata,
	)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	jsonCreated(c, object)
}

func (h *Handler) downloadObject(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	reader, object, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	defer reader.Close()

	fileName := object.Name
	if strings.TrimSpace(fileName) == "" {
		fileName = filepath.Base(object.Key)
	}
	if strings.TrimSpace(fileName) == "" {
		fileName = "download.bin"
	}

	contentType := object.ContentType
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(fileName, `"`, "_")))
	if object.Size > 0 {
		c.Header("Content-Length", strconv.FormatInt(object.Size, 10))
	}
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, reader); err != nil {
		c.Error(err)
	}
}

func (h *Handler) deleteObject(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.storageService.DeleteObject(c.Request.Context(), namespaceID, key); err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) listObjects(c *gin.Context) {
	var req service.ListObjectRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if err := h.ensureNamespaceActionAllowed(c, req.NamespaceID, "object", string(model.ActionList)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	items, total, err := h.storageService.ListObjects(c.Request.Context(), req.NamespaceID, req.Prefix, req.Page, req.PageSize)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, req.Page, req.PageSize, items)
}

func (h *Handler) listObjectVersions(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	page, pageSize := parsePage(c)
	items, total, err := h.storageService.ListObjectVersions(c.Request.Context(), namespaceID, key, page, pageSize)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) rollbackObjectVersion(c *gin.Context) {
	var req struct {
		NamespaceID string `json:"namespace_id" binding:"required"`
		Key         string `json:"key" binding:"required"`
		VersionID   string `json:"version_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, req.NamespaceID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	object, err := h.storageService.RollbackObjectVersion(c.Request.Context(), req.NamespaceID, req.Key, req.VersionID)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, object)
}

func (h *Handler) presignPutObject(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	ttlSeconds := 300
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 3600 {
			ttlSeconds = v
		}
	}

	result, err := h.storageService.PreparePresignPutObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, result)
}

func (h *Handler) completePresignPutObject(c *gin.Context) {
	var req struct {
		NamespaceID string            `json:"namespace_id" binding:"required"`
		Key         string            `json:"key" binding:"required"`
		VersionID   string            `json:"version_id" binding:"required"`
		ContentType string            `json:"content_type"`
		Metadata    map[string]string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, req.NamespaceID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	object, err := h.storageService.FinalizePresignedPut(
		c.Request.Context(),
		req.NamespaceID,
		req.Key,
		req.VersionID,
		req.ContentType,
		req.Metadata,
	)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, object)
}

func (h *Handler) presignGetObject(c *gin.Context) {
	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, namespaceID, "object", string(model.ActionShare)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	ttlSeconds := 300
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 3600 {
			ttlSeconds = v
		}
	}

	url, err := h.storageService.PresignGetObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"url": url})
}

func (h *Handler) createAKSK(c *gin.Context) {
	var req struct {
		Description  string `json:"description"`
		ExpiresInDays int   `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	userID := getUserID(c)
	if userID == "" {
		jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
		return
	}

	accessKey, secretKey, err := authpkg.GenerateAKSK()
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	var expiresAt *time.Time
	if req.ExpiresInDays > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour)
		expiresAt = &t
	}

	record := &model.AKSK{
		UserID:      userID,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		Description: strings.TrimSpace(req.Description),
		Status:      model.AKSKStatusActive,
		ExpiresAt:   expiresAt,
	}
	if err := h.db.WithContext(c.Request.Context()).Create(record).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	jsonCreated(c, gin.H{
		"id":          record.ID,
		"access_key":  record.AccessKey,
		"secret_key":  record.SecretKey,
		"description": record.Description,
		"status":      record.Status,
		"expires_at":  record.ExpiresAt,
		"created_at":  record.CreatedAt,
	})
}

func (h *Handler) listAKSK(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
		return
	}
	items := make([]*model.AKSK, 0, 16)
	if err := h.db.WithContext(c.Request.Context()).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&items).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) revokeAKSK(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		jsonError(c, http.StatusBadRequest, errors.New("id is required"))
		return
	}

	result := h.db.WithContext(c.Request.Context()).
		Model(&model.AKSK{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("status", model.AKSKStatusRevoked)
	if result.Error != nil {
		jsonError(c, http.StatusInternalServerError, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		jsonError(c, http.StatusNotFound, errors.New("aksk not found"))
		return
	}
	jsonSuccess(c, gin.H{"revoked": true})
}

func (h *Handler) listAuditLogs(c *gin.Context) {
	page, pageSize := parsePage(c)

	query := h.db.WithContext(c.Request.Context()).Model(&model.AuditLog{})
	if action := strings.TrimSpace(c.Query("action")); action != "" {
		query = query.Where("action = ?", strings.ToLower(action))
	}
	if resource := strings.TrimSpace(c.Query("resource")); resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if resourceID := strings.TrimSpace(c.Query("resource_id")); resourceID != "" {
		query = query.Where("resource_id = ?", resourceID)
	}
	if rawFrom := strings.TrimSpace(c.Query("from")); rawFrom != "" {
		from, err := parseAuditTime(rawFrom, false)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid from: %w", err))
			return
		}
		query = query.Where("created_at >= ?", from)
	}
	if rawTo := strings.TrimSpace(c.Query("to")); rawTo != "" {
		to, err := parseAuditTime(rawTo, true)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid to: %w", err))
			return
		}
		query = query.Where("created_at < ?", to)
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "audit", string(model.ActionRead))
	if err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if !unrestricted {
		nsIDs := namespaceIDSetToSlice(scope)
		if len(nsIDs) == 0 {
			jsonPage(c, 0, page, pageSize, []*model.AuditLog{})
			return
		}
		conditions := make([]string, 0, len(nsIDs))
		args := make([]any, 0, len(nsIDs))
		for _, nsID := range nsIDs {
			prefix := fmt.Sprintf("%%\"namespace_id\":\"%s\"%%", nsID)
			conditions = append(conditions, "detail LIKE ?")
			args = append(args, prefix)
		}
		query = query.Where("("+strings.Join(conditions, " OR ")+")", args...)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	items := make([]*model.AuditLog, 0, pageSize)
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) ensureNamespaceOwnerExists(ctx context.Context, ownerUserID string) error {
	ownerUserID = strings.TrimSpace(ownerUserID)
	if ownerUserID == "" {
		return nil
	}
	var count int64
	if err := h.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", ownerUserID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("owner user not found")
	}
	return nil
}

func (h *Handler) auditLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.FullPath()
		if !strings.HasPrefix(path, "/api/v1/") {
			c.Next()
			return
		}
		if strings.HasPrefix(path, "/api/v1/auth/login") {
			c.Next()
			return
		}

		start := time.Now()
		requestBodyHash := hashJSONRequestBody(c.Request)
		c.Next()

		var userIDPtr *string
		if userID := getUserID(c); userID != "" {
			userIDPtr = &userID
		}

		fullPath := c.FullPath()
		if fullPath == "" {
			fullPath = c.Request.URL.Path
		}
		resource := strings.Trim(strings.TrimPrefix(fullPath, "/api/v1/"), "/")
		if resource == "" {
			resource = "unknown"
		}

		resourceID := strings.TrimSpace(c.Param("id"))
		if resourceID == "" {
			resourceID = strings.TrimSpace(c.Query("key"))
		}

		authType := ""
		if v, ok := c.Get(ctxAuthType); ok {
			if s, ok := v.(string); ok {
				authType = s
			}
		}

		status := "success"
		if c.Writer.Status() >= http.StatusBadRequest {
			status = "failed"
		}

		detail := map[string]any{
			"method":      c.Request.Method,
			"path":        fullPath,
			"status_code": c.Writer.Status(),
			"duration_ms": time.Since(start).Milliseconds(),
			"auth_type":   authType,
		}
		if requestBodyHash != "" {
			detail["request_body_sha256"] = requestBodyHash
		}
		if before, ok := getAuditMapFromContext(c, ctxAuditBefore); ok {
			detail["before"] = before
		}
		if after, ok := getAuditMapFromContext(c, ctxAuditAfter); ok {
			detail["after"] = after
		}
		if before, okBefore := getAuditMapFromContext(c, ctxAuditBefore); okBefore {
			if after, okAfter := getAuditMapFromContext(c, ctxAuditAfter); okAfter {
				changes := buildAuditChanges(before, after)
				if len(changes) > 0 {
					detail["changes"] = changes
					detail["change_count"] = len(changes)
				}
			}
		}
		if lastErr := c.Errors.Last(); lastErr != nil {
			detail["error"] = lastErr.Error()
		}
		detailJSON, _ := json.Marshal(detail)

		entry := &model.AuditLog{
			UserID:     userIDPtr,
			Action:     strings.ToLower(c.Request.Method),
			Resource:   resource,
			ResourceID: resourceID,
			Detail:     string(detailJSON),
			IPAddress:  c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Status:     status,
		}
		if err := h.db.WithContext(c.Request.Context()).Create(entry).Error; err != nil {
			h.logger.Warn("failed to write audit log", zap.Error(err), zap.String("path", fullPath))
		}
	}
}

func setAuditBeforeAfter(c *gin.Context, before, after any) {
	if beforeMap := toAuditMap(before); len(beforeMap) > 0 {
		c.Set(ctxAuditBefore, beforeMap)
	}
	if afterMap := toAuditMap(after); len(afterMap) > 0 {
		c.Set(ctxAuditAfter, afterMap)
	}
}

func hashJSONRequestBody(r *http.Request) string {
	if r == nil || r.Body == nil {
		return ""
	}
	method := strings.ToUpper(strings.TrimSpace(r.Method))
	if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
		return ""
	}

	contentType := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if !strings.Contains(contentType, "application/json") {
		return ""
	}

	const maxBodyForHash = 1 << 20 // 1MB
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyForHash+1))
	if err != nil {
		r.Body = io.NopCloser(bytes.NewReader(nil))
		return ""
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	if len(body) == 0 || len(body) > maxBodyForHash {
		return ""
	}

	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func getAuditMapFromContext(c *gin.Context, key string) (map[string]any, bool) {
	raw, ok := c.Get(key)
	if !ok || raw == nil {
		return nil, false
	}
	m, ok := raw.(map[string]any)
	if !ok || len(m) == 0 {
		return nil, false
	}
	return m, true
}

func toAuditMap(v any) map[string]any {
	if v == nil {
		return nil
	}
	if existing, ok := v.(map[string]any); ok {
		return scrubAuditMap(existing)
	}

	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	result := map[string]any{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}
	return scrubAuditMap(result)
}

func scrubAuditMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return nil
	}

	sensitiveKeys := map[string]struct{}{
		"password":   {},
		"secret_key": {},
		"access_key": {},
	}
	noiseKeys := map[string]struct{}{
		"created_at":    {},
		"updated_at":    {},
		"deleted_at":    {},
		"last_login":    {},
		"last_login_at": {},
	}

	result := make(map[string]any, len(input))
	for key, value := range input {
		k := strings.ToLower(strings.TrimSpace(key))
		if _, sensitive := sensitiveKeys[k]; sensitive {
			continue
		}
		if _, noise := noiseKeys[k]; noise {
			continue
		}
		result[key] = value
	}
	return result
}

func buildAuditChanges(before, after map[string]any) []map[string]any {
	if len(before) == 0 && len(after) == 0 {
		return nil
	}

	fieldSet := make(map[string]struct{}, len(before)+len(after))
	for key := range before {
		fieldSet[key] = struct{}{}
	}
	for key := range after {
		fieldSet[key] = struct{}{}
	}

	fields := make([]string, 0, len(fieldSet))
	for key := range fieldSet {
		fields = append(fields, key)
	}
	sort.Strings(fields)

	changes := make([]map[string]any, 0, len(fields))
	for _, field := range fields {
		beforeValue, beforeOK := before[field]
		afterValue, afterOK := after[field]
		if beforeOK != afterOK || !reflect.DeepEqual(beforeValue, afterValue) {
			changes = append(changes, map[string]any{
				"field":  field,
				"before": beforeValue,
				"after":  afterValue,
			})
		}
	}
	return changes
}

func (h *Handler) ensureNamespaceActionAllowed(c *gin.Context, namespaceID, resource, action string) error {
	scope, unrestricted, err := h.namespaceScopeForAction(c, resource, action)
	if err != nil {
		return err
	}
	if unrestricted {
		return nil
	}
	if namespaceID == "" {
		return errors.New("namespace id is required")
	}
	if _, ok := scope[namespaceID]; !ok {
		return errors.New("namespace access denied")
	}
	return nil
}

func (h *Handler) ensureAssignableRoles(c *gin.Context, roleIDs []string, action string) error {
	roleIDs = normalizeIDList(roleIDs)
	if len(roleIDs) == 0 {
		return nil
	}

	actorUserID := getUserID(c)
	if actorUserID == "" {
		return errors.New("invalid auth context")
	}

	isAdmin, err := h.isAdmin(c)
	if err != nil {
		return err
	}
	if isAdmin {
		return nil
	}

	var actorMaxLevel int
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("COALESCE(MAX(roles.level), 0)").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ?", actorUserID).
		Scan(&actorMaxLevel).Error; err != nil {
		return err
	}

	type roleMeta struct {
		ID       string
		Code     string
		IsSystem bool
		Level    int
	}
	roles := make([]roleMeta, 0, len(roleIDs))
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("id, code, is_system, level").
		Where("id IN ?", roleIDs).
		Find(&roles).Error; err != nil {
		return err
	}
	if len(roles) != len(roleIDs) {
		return errors.New("contains invalid role_ids")
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "user", action)
	if err != nil {
		return err
	}

	type roleNamespaceRow struct {
		RoleID      string `gorm:"column:role_id"`
		NamespaceID string `gorm:"column:namespace_id"`
	}
	roleNamespaceRows := make([]roleNamespaceRow, 0, len(roleIDs))
	if err := h.db.WithContext(c.Request.Context()).
		Table("role_namespaces").
		Select("role_id, namespace_id").
		Where("role_id IN ?", roleIDs).
		Scan(&roleNamespaceRows).Error; err != nil {
		return err
	}
	roleNamespaceMap := make(map[string][]string, len(roleIDs))
	for _, row := range roleNamespaceRows {
		roleNamespaceMap[row.RoleID] = append(roleNamespaceMap[row.RoleID], row.NamespaceID)
	}

	for _, role := range roles {
		if role.Code == model.RoleCodeAdmin && !isAdmin {
			return errors.New("permission denied: can not assign admin role")
		}
		if role.IsSystem && !isAdmin {
			return errors.New("permission denied: can not assign system role")
		}
		if role.Level > actorMaxLevel {
			return errors.New("permission denied: can not assign higher-level role")
		}

		if unrestricted {
			continue
		}
		targetNamespaces := roleNamespaceMap[role.ID]
		if len(targetNamespaces) == 0 {
			return errors.New("permission denied: scoped operator can not assign global role")
		}
		for _, namespaceID := range targetNamespaces {
			if _, ok := scope[namespaceID]; !ok {
				return errors.New("permission denied: can not assign role outside your namespace scope")
			}
		}
	}

	return nil
}

func (h *Handler) ensureRoleMutationAllowed(
	c *gin.Context,
	targetRoleID string,
	action string,
	targetLevel int,
	permissionIDs []string,
	namespaceIDs []string,
) error {
	actorUserID := getUserID(c)
	if actorUserID == "" {
		return errors.New("invalid auth context")
	}

	isAdmin, err := h.isAdmin(c)
	if err != nil {
		return err
	}
	if isAdmin {
		return nil
	}

	permissionIDs = normalizeIDList(permissionIDs)
	namespaceIDs = normalizeIDList(namespaceIDs)

	var actorMaxLevel int
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("COALESCE(MAX(roles.level), 0)").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ?", actorUserID).
		Scan(&actorMaxLevel).Error; err != nil {
		return err
	}

	if targetLevel > actorMaxLevel {
		return errors.New("permission denied: can not manage higher-level role")
	}

	if targetRoleID != "" {
		type targetRoleMeta struct {
			ID       string
			Code     string
			IsSystem bool
			Level    int
		}
		var meta targetRoleMeta
		if err := h.db.WithContext(c.Request.Context()).
			Table("roles").
			Select("id, code, is_system, level").
			First(&meta, "id = ?", targetRoleID).Error; err != nil {
			return err
		}
		if !isAdmin && (meta.IsSystem || strings.EqualFold(meta.Code, model.RoleCodeAdmin)) {
			return errors.New("permission denied: can not manage protected role")
		}
		if meta.Level > actorMaxLevel {
			return errors.New("permission denied: can not manage higher-level role")
		}
	}

	if len(permissionIDs) > 0 {
		actorPermissionIDs := make([]string, 0, 32)
		if err := h.db.WithContext(c.Request.Context()).
			Table("permissions").
			Select("DISTINCT permissions.id").
			Joins("JOIN role_permissions rp ON rp.permission_id = permissions.id").
			Joins("JOIN roles r ON r.id = rp.role_id").
			Joins("JOIN user_roles ur ON ur.role_id = r.id").
			Where("ur.user_id = ?", actorUserID).
			Pluck("permissions.id", &actorPermissionIDs).Error; err != nil {
			return err
		}
		actorPermissionSet := make(map[string]struct{}, len(actorPermissionIDs))
		for _, id := range actorPermissionIDs {
			actorPermissionSet[id] = struct{}{}
		}
		for _, id := range permissionIDs {
			if _, ok := actorPermissionSet[id]; !ok {
				return errors.New("permission denied: can not grant permissions you don't have")
			}
		}
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "user", action)
	if err != nil {
		return err
	}
	if unrestricted {
		return nil
	}

	if len(namespaceIDs) == 0 {
		return errors.New("permission denied: scoped operator can not manage global role")
	}
	for _, namespaceID := range namespaceIDs {
		if _, ok := scope[namespaceID]; !ok {
			return errors.New("permission denied: role namespace scope exceeds your own")
		}
	}
	return nil
}

func (h *Handler) ensureUserActionAllowed(c *gin.Context, targetUserID, action string) error {
	if targetUserID == "" {
		return errors.New("user id is required")
	}
	if targetUserID == getUserID(c) {
		return nil
	}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "user", action)
	if err != nil {
		return err
	}
	if unrestricted {
		return nil
	}
	if len(scope) == 0 {
		return errors.New("user access denied")
	}

	namespaceIDs := namespaceIDSetToSlice(scope)
	if len(namespaceIDs) == 0 {
		return errors.New("user access denied")
	}

	var count int64
	err = h.db.WithContext(c.Request.Context()).
		Table("user_roles ur").
		Joins("JOIN roles r ON r.id = ur.role_id").
		Joins("LEFT JOIN role_namespaces rn ON rn.role_id = r.id").
		Where("ur.user_id = ?", targetUserID).
		Where("(rn.namespace_id IN ? OR rn.role_id IS NULL)", namespaceIDs).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New("user access denied")
	}
	return nil
}

func (h *Handler) isAdmin(c *gin.Context) (bool, error) {
	userID := getUserID(c)
	if strings.TrimSpace(userID) == "" {
		return false, nil
	}

	var count int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ?", userID, model.RoleCodeAdmin).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (h *Handler) namespaceScopeForAction(c *gin.Context, resource, action string) (map[string]struct{}, bool, error) {
	userID := getUserID(c)
	if userID == "" {
		return nil, false, errors.New("invalid auth context")
	}

	isAdmin, err := h.isAdmin(c)
	if err != nil {
		return nil, false, err
	}
	if isAdmin {
		return nil, true, nil
	}

	roleIDs := make([]string, 0, 8)
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("DISTINCT roles.id").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Joins("JOIN role_permissions rp ON rp.role_id = roles.id").
		Joins("JOIN permissions p ON p.id = rp.permission_id").
		Where("ur.user_id = ?", userID).
		Where("p.resource = ?", resource).
		Where("p.action = ? OR p.action = ?", action, string(model.ActionAdmin)).
		Pluck("roles.id", &roleIDs).Error; err != nil {
		return nil, false, err
	}
	if len(roleIDs) == 0 {
		return nil, false, errors.New("permission denied")
	}

	scopedRoleIDs := make([]string, 0, len(roleIDs))
	if err := h.db.WithContext(c.Request.Context()).
		Table("role_namespaces").
		Select("DISTINCT role_id").
		Where("role_id IN ?", roleIDs).
		Pluck("role_id", &scopedRoleIDs).Error; err != nil {
		return nil, false, err
	}
	if len(scopedRoleIDs) == 0 {
		return nil, true, nil
	}

	scopedSet := make(map[string]struct{}, len(scopedRoleIDs))
	for _, id := range scopedRoleIDs {
		scopedSet[id] = struct{}{}
	}
	for _, roleID := range roleIDs {
		if _, scoped := scopedSet[roleID]; !scoped {
			return nil, true, nil
		}
	}

	namespaceIDs := make([]string, 0, 16)
	if err := h.db.WithContext(c.Request.Context()).
		Table("role_namespaces").
		Select("DISTINCT namespace_id").
		Where("role_id IN ?", scopedRoleIDs).
		Pluck("namespace_id", &namespaceIDs).Error; err != nil {
		return nil, false, err
	}

	result := make(map[string]struct{}, len(namespaceIDs))
	for _, id := range namespaceIDs {
		result[id] = struct{}{}
	}
	return result, false, nil
}

func namespaceIDSetToSlice(set map[string]struct{}) []string {
	if len(set) == 0 {
		return nil
	}
	items := make([]string, 0, len(set))
	for id := range set {
		items = append(items, id)
	}
	return items
}

func normalizeIDList(ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	unique := make(map[string]struct{}, len(ids))
	items := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := unique[id]; exists {
			continue
		}
		unique[id] = struct{}{}
		items = append(items, id)
	}
	return items
}

func parsePage(c *gin.Context) (page, pageSize int) {
	page = 1
	pageSize = 20
	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			page = v
		}
	}
	if raw := strings.TrimSpace(c.Query("page_size")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 100 {
			pageSize = v
		}
	}
	return
}

func parseMetadata(value string) map[string]string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var metadata map[string]string
	if err := json.Unmarshal([]byte(value), &metadata); err != nil {
		return nil
	}
	return metadata
}

func parseAuditTime(raw string, endOfDay bool) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, errors.New("empty time")
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		if endOfDay {
			return t.Add(24 * time.Hour), nil
		}
		return t, nil
	}
	return time.Time{}, errors.New("supported formats: RFC3339 or YYYY-MM-DD")
}
