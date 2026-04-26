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
	tenantService    *service.TenantService
	userService      *service.UserService
	roleService      *service.RoleService
	namespaceService *service.NamespaceService
	storageService   *service.StorageService
	baiduService     *service.BaiduConnectorService
	registry         *storage.Registry
	shareService     *service.ShareService

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
	h := &Handler{
		cfg:              cfg,
		db:               db,
		redis:            rdb,
		logger:           logger,
		tenantService:    service.NewTenantService(db, logger),
		userService:      service.NewUserService(db, logger, cfg.JWT.Secret),
		roleService:      service.NewRoleService(db, logger),
		namespaceService: service.NewNamespaceService(db, logger),
		storageService:   service.NewStorageService(db, logger, registry),
		baiduService:     service.NewBaiduConnectorService(db, logger, cfg.Baidu, cfg.JWT.Secret),
		registry:         registry,
		shareService:     service.NewShareService(db, logger, filepath.Join("storage", "share", "files")),
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

	if _, err := h.tenantService.EnsurePlatformAdminRole(context.Background()); err != nil {
		logger.Warn("failed to ensure platform admin role", zap.Error(err))
	}
	if err := h.autoBootstrapPlatformAdmin(context.Background()); err != nil {
		logger.Warn("failed to auto bootstrap platform admin user", zap.Error(err))
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
			v1.POST("/bootstrap/tenant-admin", h.bootstrapTenantAdmin)
			v1.POST("/bootstrap/platform-admin", h.bootstrapPlatformAdmin)
		} else {
			v1.POST("/bootstrap/tenant-admin", h.bootstrapTenantAdminDisabled)
			v1.POST("/bootstrap/platform-admin", h.bootstrapPlatformAdminDisabled)
		}

		authed := v1.Group("")
		authed.Use(authMiddleware.RequireAuth(), h.auditLogMiddleware(), h.apiCallQuotaMiddleware())
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

			authed.GET("/tenants", authMiddleware.RequirePermission("tenant", "list"), h.listTenants)
			authed.GET("/tenants/:id", authMiddleware.RequirePermission("tenant", "read"), h.getTenant)
			authed.POST("/tenants", authMiddleware.RequirePermission("tenant", "create"), h.createTenant)
			authed.PUT("/tenants/:id", authMiddleware.RequirePermission("tenant", "update"), h.updateTenant)
			authed.DELETE("/tenants/:id", authMiddleware.RequirePermission("tenant", "delete"), h.deleteTenant)

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

			authed.GET("/audit/logs", authMiddleware.RequirePermission("tenant", "read"), h.listAuditLogs)
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

	resp, err := h.userService.LoginWithEmail(c.Request.Context(), req.TenantCode, req.Email, req.Password)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}
	jsonSuccess(c, resp)
}

func (h *Handler) bootstrapTenantAdminDisabled(c *gin.Context) {
	jsonError(c, http.StatusForbidden, errors.New("public tenant bootstrap is disabled"))
}

func (h *Handler) bootstrapPlatformAdminDisabled(c *gin.Context) {
	jsonError(c, http.StatusForbidden, errors.New("public platform bootstrap is disabled"))
}

type bootstrapTenantAdminRequest struct {
	Tenant service.CreateTenantRequest `json:"tenant" binding:"required"`
	Admin  struct {
		Username string `json:"username"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Nickname string `json:"nickname"`
	} `json:"admin" binding:"required"`
}

func (h *Handler) bootstrapTenantAdmin(c *gin.Context) {
	var req bootstrapTenantAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	tenant, err := h.tenantService.CreateTenant(c.Request.Context(), &req.Tenant)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var role model.Role
	if err := h.db.WithContext(c.Request.Context()).First(&role, "tenant_id = ? AND code = ?", tenant.ID, model.RoleCodeTenantAdmin).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), tenant.ID, &service.CreateUserRequest{
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

	loginResp, err := h.userService.Login(c.Request.Context(), tenant.Code, req.Admin.Email, req.Admin.Password)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	jsonCreated(c, gin.H{"tenant": tenant, "admin_user": user, "auth": loginResp})
}

type bootstrapPlatformAdminRequest struct {
	TenantCode string `json:"tenant_code" binding:"required"`
	Admin      struct {
		Username string `json:"username"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Nickname string `json:"nickname"`
	} `json:"admin" binding:"required"`
}

func (h *Handler) bootstrapPlatformAdmin(c *gin.Context) {
	var req bootstrapPlatformAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var platformAdminCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("roles.code = ? AND roles.tenant_id IS NULL", model.RoleCodePlatformAdmin).
		Count(&platformAdminCount).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	if platformAdminCount > 0 {
		jsonError(c, http.StatusForbidden, errors.New("platform admin already exists"))
		return
	}

	tenant, err := h.tenantService.GetTenantByCode(c.Request.Context(), strings.TrimSpace(req.TenantCode))
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if tenant.Status != model.TenantStatusActive {
		jsonError(c, http.StatusBadRequest, errors.New("tenant is not active"))
		return
	}

	platformRole, err := h.tenantService.EnsurePlatformAdminRole(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), tenant.ID, &service.CreateUserRequest{
		Username: req.Admin.Username,
		Email:    req.Admin.Email,
		Password: req.Admin.Password,
		Nickname: req.Admin.Nickname,
		RoleIDs:  []string{platformRole.ID},
	})
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	loginResp, err := h.userService.Login(c.Request.Context(), tenant.Code, req.Admin.Email, req.Admin.Password)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	jsonCreated(c, gin.H{"tenant": tenant, "admin_user": user, "auth": loginResp})
}

func (h *Handler) autoBootstrapPlatformAdmin(ctx context.Context) error {
	if h.cfg == nil || !h.cfg.Server.AutoBootstrapPlatformAdmin {
		return nil
	}

	tenantCode := strings.ToLower(strings.TrimSpace(h.cfg.Server.PlatformAdminTenantCode))
	if tenantCode == "" {
		tenantCode = "platform"
	}
	email := strings.ToLower(strings.TrimSpace(h.cfg.Server.PlatformAdminEmail))
	password := strings.TrimSpace(h.cfg.Server.PlatformAdminPassword)
	username := strings.TrimSpace(h.cfg.Server.PlatformAdminUsername)
	nickname := strings.TrimSpace(h.cfg.Server.PlatformAdminNickname)

	missing := make([]string, 0, 2)
	if email == "" {
		missing = append(missing, "server.platform_admin_email")
	}
	if password == "" {
		missing = append(missing, "server.platform_admin_password")
	}
	if len(missing) > 0 {
		return fmt.Errorf("auto bootstrap platform admin is enabled but missing config: %s", strings.Join(missing, ", "))
	}
	if len(password) < 6 {
		return errors.New("server.platform_admin_password must be at least 6 characters")
	}

	tenant, err := h.ensurePlatformTenant(ctx, tenantCode)
	if err != nil {
		return err
	}
	if tenant.Status != model.TenantStatusActive {
		if err := h.db.WithContext(ctx).
			Model(&model.Tenant{}).
			Where("id = ?", tenant.ID).
			Update("status", model.TenantStatusActive).Error; err != nil {
			return err
		}
		tenant.Status = model.TenantStatusActive
		h.logger.Info("reactivated platform tenant for auto bootstrap",
			zap.String("tenant_id", tenant.ID),
			zap.String("tenant_code", tenant.Code),
		)
	}

	role, err := h.tenantService.EnsurePlatformAdminRole(ctx)
	if err != nil {
		return err
	}

	var user model.User
	err = h.db.WithContext(ctx).
		First(&user, "tenant_id = ? AND lower(email) = ?", tenant.ID, email).Error
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
			h.logger.Info("bound platform admin role to existing configured user",
				zap.String("tenant_id", tenant.ID),
				zap.String("user_id", user.ID),
				zap.String("email", email),
			)
		}
		return nil
	}

	var platformAdminCount int64
	if err := h.db.WithContext(ctx).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("roles.code = ? AND roles.tenant_id IS NULL", model.RoleCodePlatformAdmin).
		Count(&platformAdminCount).Error; err != nil {
		return err
	}
	if platformAdminCount > 0 {
		h.logger.Info("platform admin already exists, skip auto bootstrap",
			zap.Int64("existing_count", platformAdminCount),
		)
		return nil
	}

	created, err := h.userService.CreateUser(ctx, tenant.ID, &service.CreateUserRequest{
		Username: username,
		Email:    email,
		Password: password,
		Nickname: nickname,
		RoleIDs:  []string{role.ID},
	})
	if err != nil {
		return err
	}

	h.logger.Info("auto bootstrapped platform admin user",
		zap.String("tenant_id", tenant.ID),
		zap.String("tenant_code", tenant.Code),
		zap.String("user_id", created.ID),
		zap.String("email", created.Email),
	)
	return nil
}

func (h *Handler) ensurePlatformTenant(ctx context.Context, tenantCode string) (*model.Tenant, error) {
	if tenantCode == "" {
		return nil, errors.New("platform tenant code is required")
	}

	var tenant model.Tenant
	if err := h.db.WithContext(ctx).First(&tenant, "code = ?", tenantCode).Error; err == nil {
		return &tenant, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	req := &service.CreateTenantRequest{
		Name:        fmt.Sprintf("platform-%s", tenantCode),
		Code:        tenantCode,
		Description: "Platform system tenant for global administrators",
	}
	created, err := h.tenantService.CreateTenant(ctx, req)
	if err != nil {
		return nil, err
	}
	h.logger.Info("auto created platform tenant",
		zap.String("tenant_id", created.ID),
		zap.String("tenant_code", created.Code),
	)
	return created, nil
}

func (h *Handler) createTenant(c *gin.Context) {
	var req service.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	tenant, err := h.tenantService.CreateTenant(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, tenant)
}

func (h *Handler) getTenant(c *gin.Context) {
	tenantID := c.Param("id")
	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	tenant, err := h.tenantService.GetTenant(c.Request.Context(), tenantID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	jsonSuccess(c, tenant)
}

func (h *Handler) listTenants(c *gin.Context) {
	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	if isPlatformAdmin {
		page, pageSize := parsePage(c)
		req := &service.ListTenantRequest{
			Page:     page,
			PageSize: pageSize,
			Status:   strings.TrimSpace(c.Query("status")),
			Keyword:  strings.TrimSpace(c.Query("keyword")),
		}
		items, total, err := h.tenantService.ListTenants(c.Request.Context(), req)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			return
		}
		jsonPage(c, total, page, pageSize, items)
		return
	}

	currentTenantID := getTenantID(c)
	tenant, err := h.tenantService.GetTenant(c.Request.Context(), currentTenantID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	jsonPage(c, 1, 1, 1, []*model.Tenant{tenant})
}

func (h *Handler) updateTenant(c *gin.Context) {
	tenantID := c.Param("id")
	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	before, err := h.tenantService.GetTenant(c.Request.Context(), tenantID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	var req service.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	tenant, err := h.tenantService.UpdateTenant(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, before, tenant)
	jsonSuccess(c, tenant)
}

func (h *Handler) deleteTenant(c *gin.Context) {
	tenantID := c.Param("id")
	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.tenantService.DeleteTenant(c.Request.Context(), tenantID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) createUser(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.tenantService.CheckQuota(c.Request.Context(), tenantID, service.QuotaTypeUser); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var req service.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureAssignableRoles(c, tenantID, req.RoleIDs, string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	user, err := h.userService.CreateUser(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", tenantID).
		Update("used_users", gorm.Expr("used_users + ?", 1)).Error

	jsonCreated(c, user)
}

func (h *Handler) getUser(c *gin.Context) {
	user, err := h.userService.GetUser(c.Request.Context(), c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if user.TenantID != getTenantID(c) {
		isPlatformAdmin, err := h.isPlatformAdmin(c)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			return
		}
		if !isPlatformAdmin {
			jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
			return
		}
	}
	if err := h.ensureUserActionAllowed(c, user.ID, string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	jsonSuccess(c, user)
}

func (h *Handler) listUsers(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	page, pageSize := parsePage(c)
	req := service.ListUserRequest{
		Page:          page,
		PageSize:      pageSize,
		Status:        c.Query("status"),
		Keyword:       c.Query("keyword"),
		CurrentUserID: getUserID(c),
	}
	scope, unrestricted, err := h.namespaceScopeForAction(c, "user", string(model.ActionList))
	if err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if !unrestricted {
		req.ScopeFiltered = true
		req.VisibleNamespaceIDs = namespaceIDSetToSlice(scope)
	}

	items, total, err := h.userService.ListUsers(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) updateUser(c *gin.Context) {
	userID := c.Param("id")
	user, err := h.userService.GetUser(c.Request.Context(), userID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if user.TenantID != getTenantID(c) {
		isPlatformAdmin, err := h.isPlatformAdmin(c)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			return
		}
		if !isPlatformAdmin {
			jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
			return
		}
	}
	if err := h.ensureUserActionAllowed(c, userID, string(model.ActionUpdate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	var req service.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	targetTenantID := user.TenantID
	if len(req.RoleIDs) > 0 {
		if err := h.ensureAssignableRoles(c, targetTenantID, req.RoleIDs, string(model.ActionUpdate)); err != nil {
			jsonError(c, http.StatusForbidden, err)
			return
		}
	}
	updated, err := h.userService.UpdateUser(c.Request.Context(), userID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, user, updated)
	jsonSuccess(c, updated)
}

func (h *Handler) deleteUser(c *gin.Context) {
	userID := c.Param("id")
	user, err := h.userService.GetUser(c.Request.Context(), userID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if user.TenantID != getTenantID(c) {
		isPlatformAdmin, err := h.isPlatformAdmin(c)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			return
		}
		if !isPlatformAdmin {
			jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
			return
		}
	}
	if err := h.ensureUserActionAllowed(c, userID, string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	if err := h.userService.DeleteUser(c.Request.Context(), userID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", user.TenantID).
		Update("used_users", gorm.Expr("CASE WHEN used_users > 0 THEN used_users - 1 ELSE 0 END")).Error
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
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	items, err := h.roleService.ListRoles(c.Request.Context(), tenantID)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) createRole(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var req service.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.ensureRoleMutationAllowed(
		c,
		tenantID,
		"",
		string(model.ActionCreate),
		req.Level,
		req.PermissionIDs,
		req.NamespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	role, err := h.roleService.CreateRole(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, nil, role)
	jsonCreated(c, role)
}

func (h *Handler) updateRole(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var req service.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	current, err := h.roleService.GetRole(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	targetLevel := current.Level
	if req.Level != nil {
		targetLevel = *req.Level
	}
	targetPermissionIDs := make([]string, 0, len(current.Permissions))
	for _, item := range current.Permissions {
		targetPermissionIDs = append(targetPermissionIDs, item.ID)
	}
	if req.PermissionIDs != nil {
		targetPermissionIDs = append([]string{}, (*req.PermissionIDs)...)
	}
	targetNamespaceIDs := make([]string, 0, len(current.Namespaces))
	for _, item := range current.Namespaces {
		targetNamespaceIDs = append(targetNamespaceIDs, item.ID)
	}
	if req.NamespaceIDs != nil {
		targetNamespaceIDs = append([]string{}, (*req.NamespaceIDs)...)
	}

	if err := h.ensureRoleMutationAllowed(
		c,
		tenantID,
		current.ID,
		string(model.ActionUpdate),
		targetLevel,
		targetPermissionIDs,
		targetNamespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	role, err := h.roleService.UpdateRole(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, current, role)
	jsonSuccess(c, role)
}

func (h *Handler) deleteRole(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	current, err := h.roleService.GetRole(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	targetPermissionIDs := make([]string, 0, len(current.Permissions))
	for _, item := range current.Permissions {
		targetPermissionIDs = append(targetPermissionIDs, item.ID)
	}
	targetNamespaceIDs := make([]string, 0, len(current.Namespaces))
	for _, item := range current.Namespaces {
		targetNamespaceIDs = append(targetNamespaceIDs, item.ID)
	}
	if err := h.ensureRoleMutationAllowed(
		c,
		tenantID,
		current.ID,
		string(model.ActionDelete),
		current.Level,
		targetPermissionIDs,
		targetNamespaceIDs,
	); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.roleService.DeleteRole(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, current, nil)
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
	jsonSuccess(c, gin.H{"changed": true})
}

func (h *Handler) createNamespace(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if err := h.tenantService.CheckQuota(c.Request.Context(), tenantID, service.QuotaTypeNamespace); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var req service.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	ns, err := h.namespaceService.CreateNamespace(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", tenantID).
		Update("used_namespaces", gorm.Expr("used_namespaces + ?", 1)).Error

	jsonCreated(c, ns)
}

func (h *Handler) getNamespace(c *gin.Context) {
	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "namespace", string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	jsonSuccess(c, ns)
}

func (h *Handler) listNamespaces(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	page, pageSize := parsePage(c)
	req := service.ListNamespaceRequest{Page: page, PageSize: pageSize, Status: c.Query("status")}

	scope, unrestricted, err := h.namespaceScopeForAction(c, "namespace", string(model.ActionList))
	if err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if !unrestricted {
		if len(scope) == 0 {
			jsonPage(c, 0, page, pageSize, []*model.Namespace{})
			return
		}
		req.NamespaceIDs = namespaceIDSetToSlice(scope)
	}

	items, total, err := h.namespaceService.ListNamespaces(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) updateNamespace(c *gin.Context) {
	nsID := c.Param("id")
	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), nsID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "namespace", string(model.ActionUpdate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	var req service.UpdateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	updated, err := h.namespaceService.UpdateNamespace(c.Request.Context(), nsID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	setAuditBeforeAfter(c, ns, updated)
	jsonSuccess(c, updated)
}

func (h *Handler) deleteNamespace(c *gin.Context) {
	nsID := c.Param("id")
	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), nsID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "namespace", string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.namespaceService.DeleteNamespace(c.Request.Context(), nsID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", ns.TenantID).
		Update("used_namespaces", gorm.Expr("CASE WHEN used_namespaces > 0 THEN used_namespaces - 1 ELSE 0 END")).Error

	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) createStorageConfig(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	var req service.CreateStorageConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	cfg, err := h.storageService.CreateStorageConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonCreated(c, cfg)
}

func (h *Handler) listStorageConfigs(c *gin.Context) {
	tenantID, err := h.resolveTargetTenantID(c)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	items, err := h.storageService.ListStorageConfigs(c.Request.Context(), tenantID)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) deleteStorageConfig(c *gin.Context) {
	configID := c.Param("id")
	cfg, err := h.storageService.GetStorageConfig(c.Request.Context(), configID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, cfg.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.storageService.DeleteStorageConfig(c.Request.Context(), configID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) uploadObject(c *gin.Context) {
	namespaceID := c.PostForm("namespace_id")
	key := c.PostForm("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		jsonError(c, http.StatusBadRequest, errors.New("file is required"))
		return
	}
	defer file.Close()

	if err := h.tenantService.CheckStorageGrowth(c.Request.Context(), ns.TenantID, header.Size); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	if ns.MaxFileSize != nil && *ns.MaxFileSize > 0 && header.Size > *ns.MaxFileSize {
		jsonError(c, http.StatusBadRequest, errors.New("namespace max file size exceeded"))
		return
	}
	if ns.MaxStorage != nil && *ns.MaxStorage > 0 && ns.UsedStorage+header.Size > *ns.MaxStorage {
		jsonError(c, http.StatusBadRequest, errors.New("namespace storage quota exceeded"))
		return
	}

	var existingCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Model(&model.Object{}).
		Where("namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).
		Count(&existingCount).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	if existingCount == 0 && ns.MaxFiles != nil && *ns.MaxFiles > 0 && ns.UsedFiles+1 > *ns.MaxFiles {
		jsonError(c, http.StatusBadRequest, errors.New("namespace max files quota exceeded"))
		return
	}

	contentType := c.PostForm("content_type")
	if contentType == "" {
		contentType = header.Header.Get("Content-Type")
	}
	metadata := parseMetadata(c.PostForm("metadata"))

	obj, err := h.storageService.PutObject(c.Request.Context(), namespaceID, key, file, header.Size, contentType, metadata)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", ns.TenantID).
		Update("used_storage", gorm.Expr("used_storage + ?", header.Size)).Error

	jsonCreated(c, obj)
}

func (h *Handler) downloadObject(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	key := c.Query("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionRead)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	reader, obj, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	defer reader.Close()

	if obj.ContentType != "" {
		c.Header("Content-Type", obj.ContentType)
	}
	c.Header("Content-Disposition", "attachment; filename=\""+obj.Name+"\"")
	if obj.ETag != "" {
		c.Header("ETag", obj.ETag)
	}
	c.Header("Content-Length", strconv.FormatInt(obj.Size, 10))
	_, _ = io.Copy(c.Writer, reader)
}

func (h *Handler) deleteObject(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	key := c.Query("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionDelete)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	_, obj, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}

	reclaimSize := obj.Size
	versions, _, versionsErr := h.storageService.ListObjectVersions(c.Request.Context(), namespaceID, key, 1, 1000)
	if versionsErr == nil && len(versions) > 0 {
		var total int64
		for _, item := range versions {
			total += item.Size
		}
		if total > 0 {
			reclaimSize = total
		}
	}

	if err := h.storageService.DeleteObject(c.Request.Context(), namespaceID, key); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
		Where("id = ?", ns.TenantID).
		Update("used_storage", gorm.Expr("CASE WHEN used_storage >= ? THEN used_storage - ? ELSE 0 END", reclaimSize, reclaimSize)).Error

	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) listObjects(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id is required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionList)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	page, pageSize := parsePage(c)
	items, total, err := h.storageService.ListObjects(c.Request.Context(), namespaceID, c.Query("prefix"), page, pageSize)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) listObjectVersions(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	key := c.Query("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionRead)); err != nil {
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

type rollbackObjectVersionRequest struct {
	NamespaceID string `json:"namespace_id" binding:"required"`
	Key         string `json:"key" binding:"required"`
	VersionID   string `json:"version_id" binding:"required"`
}

func (h *Handler) rollbackObjectVersion(c *gin.Context) {
	var req rollbackObjectVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), req.NamespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	obj, err := h.storageService.RollbackObjectVersion(c.Request.Context(), req.NamespaceID, req.Key, req.VersionID)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, obj)
}

func (h *Handler) presignPutObject(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	key := c.Query("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	ttlSeconds := int64(300)
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 && value <= 3600 {
			ttlSeconds = value
		}
	}

	prepared, err := h.storageService.PreparePresignPutObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{
		"url":         prepared.URL,
		"ttl_seconds": ttlSeconds,
		"key":         prepared.Key,
		"version_id":  prepared.VersionID,
	})
}

type completePresignPutRequest struct {
	NamespaceID string            `json:"namespace_id" binding:"required"`
	Key         string            `json:"key" binding:"required"`
	VersionID   string            `json:"version_id" binding:"required"`
	ContentType string            `json:"content_type"`
	Metadata    map[string]string `json:"metadata"`
}

func (h *Handler) completePresignPutObject(c *gin.Context) {
	var req completePresignPutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), req.NamespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionCreate)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	obj, err := h.storageService.FinalizePresignedPut(
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

	jsonSuccess(c, obj)
}

func (h *Handler) presignGetObject(c *gin.Context) {
	namespaceID := c.Query("namespace_id")
	key := c.Query("key")
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		jsonError(c, http.StatusNotFound, err)
		return
	}
	if err := h.ensureTenantOwnership(c, ns.TenantID); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}
	if err := h.ensureNamespaceActionAllowed(c, ns.ID, "object", string(model.ActionShare)); err != nil {
		jsonError(c, http.StatusForbidden, err)
		return
	}

	ttlSeconds := int64(300)
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 && value <= 3600 {
			ttlSeconds = value
		}
	}

	url, err := h.storageService.PresignGetObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"url": url, "ttl_seconds": ttlSeconds})
}

type createAKSKRequest struct {
	Description   string `json:"description"`
	ExpiresInDays int    `json:"expires_in_days"`
}

func (h *Handler) createAKSK(c *gin.Context) {
	var req createAKSKRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
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
		TenantID:    getTenantID(c),
		UserID:      getUserID(c),
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		Description: req.Description,
		Status:      model.AKSKStatusActive,
		ExpiresAt:   expiresAt,
	}
	if err := h.db.WithContext(c.Request.Context()).Create(record).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	jsonCreated(c, gin.H{
		"id":          record.ID,
		"access_key":  accessKey,
		"secret_key":  secretKey,
		"expires_at":  expiresAt,
		"description": record.Description,
	})
}

func (h *Handler) listAKSK(c *gin.Context) {
	var records []model.AKSK
	err := h.db.WithContext(c.Request.Context()).
		Where("tenant_id = ? AND user_id = ?", getTenantID(c), getUserID(c)).
		Order("created_at DESC").
		Find(&records).Error
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	items := make([]gin.H, 0, len(records))
	for _, item := range records {
		items = append(items, gin.H{
			"id":          item.ID,
			"access_key":  item.AccessKey,
			"description": item.Description,
			"status":      item.Status,
			"expires_at":  item.ExpiresAt,
			"created_at":  item.CreatedAt,
		})
	}
	jsonSuccess(c, items)
}

func (h *Handler) revokeAKSK(c *gin.Context) {
	id := c.Param("id")
	result := h.db.WithContext(c.Request.Context()).Model(&model.AKSK{}).
		Where("id = ? AND tenant_id = ? AND user_id = ?", id, getTenantID(c), getUserID(c)).
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

	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	query := h.db.WithContext(c.Request.Context()).Model(&model.AuditLog{})
	requestedTenantID := strings.TrimSpace(c.Query("tenant_id"))
	if isPlatformAdmin {
		if requestedTenantID != "" {
			if _, err := h.tenantService.GetTenant(c.Request.Context(), requestedTenantID); err != nil {
				jsonError(c, http.StatusBadRequest, err)
				return
			}
			query = query.Where("tenant_id = ?", requestedTenantID)
		}
	} else {
		currentTenantID := getTenantID(c)
		if requestedTenantID != "" && requestedTenantID != currentTenantID {
			jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
			return
		}
		query = query.Where("tenant_id = ?", currentTenantID)
	}

	if action := strings.TrimSpace(c.Query("action")); action != "" {
		query = query.Where("action = ?", action)
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

	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		from, err := parseAuditTime(raw, false)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid from time: %w", err))
			return
		}
		query = query.Where("created_at >= ?", from)
	}
	if raw := strings.TrimSpace(c.Query("to")); raw != "" {
		to, err := parseAuditTime(raw, true)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid to time: %w", err))
			return
		}
		query = query.Where("created_at < ?", to)
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

func (h *Handler) apiCallQuotaMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := getTenantID(c)
		if tenantID == "" {
			jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
			c.Abort()
			return
		}

		ctx := c.Request.Context()
		today := time.Now().UTC().Format("2006-01-02")
		if err := h.resetDailyAPICallCounter(ctx, tenantID, today); err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			c.Abort()
			return
		}

		tenant, err := h.tenantService.GetTenant(ctx, tenantID)
		if err != nil {
			jsonError(c, http.StatusNotFound, err)
			c.Abort()
			return
		}

		if tenant.MaxAPICalls > 0 && h.redis != nil {
			dayKey := strings.ReplaceAll(today, "-", "")
			redisKey := fmt.Sprintf("tenant:%s:api_calls:%s", tenantID, dayKey)

			count, err := h.redis.Incr(ctx, redisKey).Result()
			if err == nil {
				if count == 1 {
					_ = h.redis.Expire(ctx, redisKey, ttlUntilNextUTCDay()).Err()
				}
				if count > tenant.MaxAPICalls {
					_ = h.redis.Decr(ctx, redisKey).Err()
					jsonError(c, http.StatusTooManyRequests, errors.New("api calls quota exceeded"))
					c.Abort()
					return
				}

				_ = h.db.WithContext(ctx).Model(&model.Tenant{}).
					Where("id = ?", tenantID).
					Updates(map[string]any{
						"used_api_calls": count,
						"api_calls_date": today,
					}).Error

				c.Next()
				return
			}

			h.logger.Warn("redis api call quota fallback to db", zap.Error(err), zap.String("tenant_id", tenantID))
		}

		update := h.db.WithContext(ctx).
			Model(&model.Tenant{}).
			Where("id = ?", tenantID)
		if tenant.MaxAPICalls > 0 {
			update = update.Where("used_api_calls < ?", tenant.MaxAPICalls)
		}
		update = update.Updates(map[string]any{
			"used_api_calls": gorm.Expr("used_api_calls + 1"),
			"api_calls_date": today,
		})
		if update.Error != nil {
			jsonError(c, http.StatusInternalServerError, update.Error)
			c.Abort()
			return
		}
		if tenant.MaxAPICalls > 0 && update.RowsAffected == 0 {
			jsonError(c, http.StatusTooManyRequests, errors.New("api calls quota exceeded"))
			c.Abort()
			return
		}

		c.Next()
	}
}

func (h *Handler) resetDailyAPICallCounter(ctx context.Context, tenantID, today string) error {
	return h.db.WithContext(ctx).Model(&model.Tenant{}).
		Where("id = ?", tenantID).
		Where("api_calls_date IS NULL OR api_calls_date::date <> ?::date", today).
		Updates(map[string]any{
			"used_api_calls": 0,
			"api_calls_date": today,
		}).Error
}

func ttlUntilNextUTCDay() time.Duration {
	now := time.Now().UTC()
	next := now.Truncate(24 * time.Hour).Add(24 * time.Hour)
	ttl := time.Until(next) + time.Hour
	if ttl <= 0 {
		return 25 * time.Hour
	}
	return ttl
}

func (h *Handler) auditLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		requestBodyHash := hashJSONRequestBody(c.Request)
		c.Next()

		tenantID := getTenantID(c)
		if tenantID == "" {
			return
		}

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
			TenantID:   tenantID,
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

func (h *Handler) isPlatformAdmin(c *gin.Context) (bool, error) {
	userID := getUserID(c)
	if strings.TrimSpace(userID) == "" {
		return false, nil
	}

	var count int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND roles.tenant_id IS NULL", userID, model.RoleCodePlatformAdmin).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (h *Handler) resolveTargetTenantID(c *gin.Context) (string, error) {
	currentTenantID := strings.TrimSpace(getTenantID(c))
	if currentTenantID == "" {
		return "", errors.New("invalid auth context")
	}

	requestedTenantID := strings.TrimSpace(c.Query("tenant_id"))
	if requestedTenantID == "" || requestedTenantID == currentTenantID {
		return currentTenantID, nil
	}

	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		return "", err
	}
	if !isPlatformAdmin {
		return "", errors.New("cross-tenant access denied")
	}

	if _, err := h.tenantService.GetTenant(c.Request.Context(), requestedTenantID); err != nil {
		return "", err
	}
	return requestedTenantID, nil
}

func (h *Handler) ensureTenantOwnership(c *gin.Context, tenantID string) error {
	if tenantID == "" {
		return errors.New("tenant id is required")
	}
	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		return err
	}
	if isPlatformAdmin {
		return nil
	}
	if tenantID != getTenantID(c) {
		return errors.New("cross-tenant access denied")
	}
	return nil
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

func (h *Handler) ensureAssignableRoles(c *gin.Context, tenantID string, roleIDs []string, action string) error {
	roleIDs = normalizeIDList(roleIDs)
	if len(roleIDs) == 0 {
		return nil
	}

	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		return err
	}
	if isPlatformAdmin {
		return nil
	}

	actorUserID := getUserID(c)
	if actorUserID == "" {
		return errors.New("invalid auth context")
	}

	var actorAdminCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND (roles.tenant_id = ? OR roles.tenant_id IS NULL)", actorUserID, model.RoleCodeTenantAdmin, tenantID).
		Count(&actorAdminCount).Error; err != nil {
		return err
	}
	isTenantAdmin := actorAdminCount > 0

	var actorMaxLevel int
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("COALESCE(MAX(roles.level), 0)").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ?", actorUserID).
		Where("roles.tenant_id = ? OR roles.tenant_id IS NULL", tenantID).
		Scan(&actorMaxLevel).Error; err != nil {
		return err
	}

	type roleMeta struct {
		ID       string
		TenantID *string
		Code     string
		IsSystem bool
		Level    int
	}
	roles := make([]roleMeta, 0, len(roleIDs))
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("id, tenant_id, code, is_system, level").
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
		if role.TenantID != nil && *role.TenantID != tenantID {
			return errors.New("contains cross-tenant roles")
		}
		if role.Code == model.RoleCodeTenantAdmin && !isTenantAdmin {
			return errors.New("permission denied: can not assign tenant_admin role")
		}
		if role.IsSystem && !isTenantAdmin {
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
	tenantID string,
	targetRoleID string,
	action string,
	targetLevel int,
	permissionIDs []string,
	namespaceIDs []string,
) error {
	actorUserID := getUserID(c)
	if actorUserID == "" || tenantID == "" {
		return errors.New("invalid auth context")
	}

	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		return err
	}
	if isPlatformAdmin {
		return nil
	}

	permissionIDs = normalizeIDList(permissionIDs)
	namespaceIDs = normalizeIDList(namespaceIDs)

	var actorAdminCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND (roles.tenant_id = ? OR roles.tenant_id IS NULL)", actorUserID, model.RoleCodeTenantAdmin, tenantID).
		Count(&actorAdminCount).Error; err != nil {
		return err
	}
	isTenantAdmin := actorAdminCount > 0

	var actorMaxLevel int
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Select("COALESCE(MAX(roles.level), 0)").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ?", actorUserID).
		Where("roles.tenant_id = ? OR roles.tenant_id IS NULL", tenantID).
		Scan(&actorMaxLevel).Error; err != nil {
		return err
	}

	if targetLevel > actorMaxLevel {
		return errors.New("permission denied: can not manage higher-level role")
	}

	if targetRoleID != "" {
		type targetRoleMeta struct {
			ID       string
			TenantID *string
			Code     string
			IsSystem bool
			Level    int
		}
		var meta targetRoleMeta
		if err := h.db.WithContext(c.Request.Context()).
			Table("roles").
			Select("id, tenant_id, code, is_system, level").
			First(&meta, "id = ?", targetRoleID).Error; err != nil {
			return err
		}
		if meta.TenantID != nil && *meta.TenantID != tenantID {
			return errors.New("cross-tenant role mutation denied")
		}
		if !isTenantAdmin && (meta.IsSystem || strings.EqualFold(meta.Code, model.RoleCodeTenantAdmin)) {
			return errors.New("permission denied: can not manage protected role")
		}
		if meta.Level > actorMaxLevel {
			return errors.New("permission denied: can not manage higher-level role")
		}
	}

	if !isTenantAdmin && len(permissionIDs) > 0 {
		actorPermissionIDs := make([]string, 0, 32)
		if err := h.db.WithContext(c.Request.Context()).
			Table("permissions").
			Select("DISTINCT permissions.id").
			Joins("JOIN role_permissions rp ON rp.permission_id = permissions.id").
			Joins("JOIN roles r ON r.id = rp.role_id").
			Joins("JOIN user_roles ur ON ur.role_id = r.id").
			Where("ur.user_id = ?", actorUserID).
			Where("r.tenant_id = ? OR r.tenant_id IS NULL", tenantID).
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

func (h *Handler) namespaceScopeForAction(c *gin.Context, resource, action string) (map[string]struct{}, bool, error) {
	userID := getUserID(c)
	tenantID := getTenantID(c)
	if userID == "" || tenantID == "" {
		return nil, false, errors.New("invalid auth context")
	}

	isPlatformAdmin, err := h.isPlatformAdmin(c)
	if err != nil {
		return nil, false, err
	}
	if isPlatformAdmin {
		return nil, true, nil
	}

	var adminCount int64
	if err := h.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND (roles.tenant_id = ? OR roles.tenant_id IS NULL)", userID, model.RoleCodeTenantAdmin, tenantID).
		Count(&adminCount).Error; err != nil {
		return nil, false, err
	}
	if adminCount > 0 {
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
		Where("roles.tenant_id = ? OR roles.tenant_id IS NULL", tenantID).
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
