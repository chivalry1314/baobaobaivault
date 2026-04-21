//go:build ignore

package main

// Consolidated backend source snapshot (generated).
// This file is for single-file reading/reference and is excluded from build.

// -----------------------------------------------------------------------------
// FILE: cmd/server/main.go
// -----------------------------------------------------------------------------
// package main
// 
// import (
// 	"context"
// 	"fmt"
// 	"net/http"
// 	"os"
// 	"os/signal"
// 	"syscall"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/api"
// 	"github.com/baobaobao/baobaobaivault/internal/config"
// 	"github.com/baobaobao/baobaobaivault/pkg/database"
// 	"github.com/baobaobao/baobaobaivault/pkg/redis"
// 	"go.uber.org/zap"
// )
// 
// // @title Baobaobao Vault API
// // @version 1.0
// // @description 浜戝瓨鍌ㄧ粺涓€绠＄悊骞冲彴 API
// // @termsOfService http://swagger.io/terms/
// 
// // @contact.name API Support
// // @contact.url http://www.swagger.io/support
// // @contact.email support@swagger.io
// 
// // @license.name Apache 2.0
// // @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// 
// // @host localhost:8080
// // @BasePath /api/v1
// // @securityDefinitions.apikey BearerAuth
// // @in header
// // @name Authorization
// // @description Type "Bearer" followed by a space and JWT token.
// 
// // @securityDefinitions.apikey AKSKAuth
// // @in header
// // @name Authorization
// // @description AccessKey:Signature format for API authentication
// 
// func main() {
// 	// 鍔犺浇閰嶇疆
// 	cfg, err := config.Load()
// 	if err != nil {
// 		fmt.Printf("Failed to load config: %v\n", err)
// 		os.Exit(1)
// 	}
// 
// 	// 鍒濆鍖栨棩蹇?	logger, err := zap.NewProduction()
// 	if err != nil {
// 		fmt.Printf("Failed to init logger: %v\n", err)
// 		os.Exit(1)
// 	}
// 	defer logger.Sync()
// 
// 	// 鍒濆鍖栨暟鎹簱
// 	db, err := database.NewPostgresDB(cfg.Database, logger)
// 	if err != nil {
// 		logger.Fatal("Failed to connect database", zap.Error(err))
// 	}
// 	defer database.Close(db)
// 
// 	// 鍒濆鍖?Redis
// 	rdb, err := redis.NewClient(cfg.Redis, logger)
// 	if err != nil {
// 		logger.Fatal("Failed to connect redis", zap.Error(err))
// 	}
// 	defer redis.Close(rdb)
// 
// 	// 鑷姩杩佺Щ鏁版嵁搴撹〃
// 	if err := database.AutoMigrate(db); err != nil {
// 		logger.Fatal("Failed to migrate database", zap.Error(err))
// 	}
// 
// 	// 鍒濆鍖?API 璺敱
// 	router := api.NewRouter(cfg, db, rdb, logger)
// 
// 	// 鍚姩 HTTP 鏈嶅姟鍣?	srv := &http.Server{
// 		Addr:         ":" + cfg.Server.Port,
// 		Handler:      router,
// 		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
// 		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
// 	}
// 
// 	// 浼橀泤鍏抽棴
// 	go func() {
// 		logger.Info("Server starting", zap.String("port", cfg.Server.Port))
// 		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
// 			logger.Fatal("Server failed", zap.Error(err))
// 		}
// 	}()
// 
// 	// 绛夊緟涓柇淇″彿
// 	quit := make(chan os.Signal, 1)
// 	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
// 	<-quit
// 
// 	logger.Info("Shutting down server...")
// 
// 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
// 	defer cancel()
// 
// 	if err := srv.Shutdown(ctx); err != nil {
// 		logger.Fatal("Server forced to shutdown", zap.Error(err))
// 	}
// 
// 	logger.Info("Server exited properly")
// }

// -----------------------------------------------------------------------------
// FILE: internal/api/context.go
// -----------------------------------------------------------------------------
// package api
// 
// import (
// 	"net/http"
// 
// 	"github.com/gin-gonic/gin"
// )
// 
// const (
// 	ctxUserID   = "user_id"
// 	ctxTenantID = "tenant_id"
// 	ctxUsername = "username"
// 	ctxAuthType = "auth_type"
// )
// 
// type apiError struct {
// 	Error string `json:"error"`
// }
// 
// type pageResult struct {
// 	Total    int64 `json:"total"`
// 	Page     int   `json:"page"`
// 	PageSize int   `json:"page_size"`
// 	Items    any   `json:"items"`
// }
// 
// func jsonSuccess(c *gin.Context, data any) {
// 	c.JSON(http.StatusOK, gin.H{"data": data})
// }
// 
// func jsonCreated(c *gin.Context, data any) {
// 	c.JSON(http.StatusCreated, gin.H{"data": data})
// }
// 
// func jsonPage(c *gin.Context, total int64, page, pageSize int, items any) {
// 	c.JSON(http.StatusOK, pageResult{Total: total, Page: page, PageSize: pageSize, Items: items})
// }
// 
// func jsonError(c *gin.Context, status int, err error) {
// 	if err == nil {
// 		err = http.ErrAbortHandler
// 	}
// 	c.JSON(status, apiError{Error: err.Error()})
// }
// 
// func getTenantID(c *gin.Context) string {
// 	v, _ := c.Get(ctxTenantID)
// 	s, _ := v.(string)
// 	return s
// }
// 
// func getUserID(c *gin.Context) string {
// 	v, _ := c.Get(ctxUserID)
// 	s, _ := v.(string)
// 	return s
// }

// -----------------------------------------------------------------------------
// FILE: internal/api/middleware.go
// -----------------------------------------------------------------------------
// package api
// 
// import (
// 	"bytes"
// 	"errors"
// 	"io"
// 	"net/http"
// 	"strings"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"github.com/baobaobao/baobaobaivault/internal/service"
// 	authpkg "github.com/baobaobao/baobaobaivault/pkg/auth"
// 	"github.com/gin-gonic/gin"
// 	"gorm.io/gorm"
// )
// 
// // AuthMiddleware supports JWT and AK/SK dual authentication.
// type AuthMiddleware struct {
// 	db          *gorm.DB
// 	userService *service.UserService
// }
// 
// func NewAuthMiddleware(db *gorm.DB, userService *service.UserService) *AuthMiddleware {
// 	return &AuthMiddleware{db: db, userService: userService}
// }
// 
// func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
// 		if authorization == "" {
// 			jsonError(c, http.StatusUnauthorized, errors.New("missing Authorization header"))
// 			c.Abort()
// 			return
// 		}
// 
// 		if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
// 			if err := m.authenticateJWT(c, authorization); err != nil {
// 				jsonError(c, http.StatusUnauthorized, err)
// 				c.Abort()
// 				return
// 			}
// 			c.Next()
// 			return
// 		}
// 
// 		if err := m.authenticateAKSK(c, authorization); err != nil {
// 			jsonError(c, http.StatusUnauthorized, err)
// 			c.Abort()
// 			return
// 		}
// 		c.Next()
// 	}
// }
// 
// func (m *AuthMiddleware) RequirePermission(resource, action string) gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		userID := getUserID(c)
// 		tenantID := getTenantID(c)
// 		if userID == "" || tenantID == "" {
// 			jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
// 			c.Abort()
// 			return
// 		}
// 
// 		allowed, err := m.hasPermission(c, userID, tenantID, resource, action)
// 		if err != nil {
// 			jsonError(c, http.StatusInternalServerError, err)
// 			c.Abort()
// 			return
// 		}
// 		if !allowed {
// 			jsonError(c, http.StatusForbidden, errors.New("permission denied"))
// 			c.Abort()
// 			return
// 		}
// 		c.Next()
// 	}
// }
// 
// func (m *AuthMiddleware) authenticateJWT(c *gin.Context, authorization string) error {
// 	token, err := authpkg.ExtractBearerToken(authorization)
// 	if err != nil {
// 		return err
// 	}
// 
// 	claims, err := m.userService.ValidateToken(token)
// 	if err != nil {
// 		return err
// 	}
// 
// 	userID := claimToString(*claims, "user_id")
// 	tenantID := claimToString(*claims, "tenant_id")
// 	username := claimToString(*claims, "username")
// 	if userID == "" || tenantID == "" {
// 		return errors.New("token missing required claims")
// 	}
// 
// 	c.Set(ctxUserID, userID)
// 	c.Set(ctxTenantID, tenantID)
// 	c.Set(ctxUsername, username)
// 	c.Set(ctxAuthType, "jwt")
// 	return nil
// }
// 
// func (m *AuthMiddleware) authenticateAKSK(c *gin.Context, authorization string) error {
// 	accessKey, signature, err := authpkg.ParseAKSKAuthorization(authorization)
// 	if err != nil {
// 		return err
// 	}
// 
// 	timestamp := strings.TrimSpace(c.GetHeader(authpkg.TimestampHeaderKey))
// 	if timestamp == "" || !authpkg.TimestampWithinWindow(timestamp, 5*time.Minute) {
// 		return errors.New("invalid or expired AK/SK timestamp")
// 	}
// 
// 	body, err := io.ReadAll(c.Request.Body)
// 	if err != nil {
// 		return errors.New("failed to read request body")
// 	}
// 	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
// 
// 	canonical := authpkg.BuildCanonicalString(
// 		c.Request.Method,
// 		c.Request.URL.Path,
// 		c.Request.URL.RawQuery,
// 		timestamp,
// 		authpkg.Sha256Hex(body),
// 	)
// 
// 	var credential model.AKSK
// 	if err := m.db.WithContext(c.Request.Context()).
// 		Preload("User").
// 		First(&credential, "access_key = ? AND status = ?", accessKey, model.AKSKStatusActive).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return errors.New("invalid access key")
// 		}
// 		return err
// 	}
// 
// 	if credential.ExpiresAt != nil && credential.ExpiresAt.Before(time.Now()) {
// 		return errors.New("AK/SK expired")
// 	}
// 	if !authpkg.VerifyAKSKSignature(credential.SecretKey, canonical, signature) {
// 		return errors.New("invalid signature")
// 	}
// 	if credential.User != nil && credential.User.Status != model.UserStatusActive {
// 		return errors.New("user is not active")
// 	}
// 
// 	c.Set(ctxUserID, credential.UserID)
// 	c.Set(ctxTenantID, credential.TenantID)
// 	if credential.User != nil {
// 		c.Set(ctxUsername, credential.User.Username)
// 	}
// 	c.Set(ctxAuthType, "aksk")
// 	return nil
// }
// 
// func (m *AuthMiddleware) hasPermission(c *gin.Context, userID, tenantID, resource, action string) (bool, error) {
// 	var count int64
// 
// 	if err := m.db.WithContext(c.Request.Context()).
// 		Table("roles").
// 		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
// 		Where("ur.user_id = ? AND roles.code = ? AND (roles.tenant_id = ? OR roles.tenant_id IS NULL)", userID, "tenant_admin", tenantID).
// 		Count(&count).Error; err != nil {
// 		return false, err
// 	}
// 	if count > 0 {
// 		return true, nil
// 	}
// 
// 	count = 0
// 	err := m.db.WithContext(c.Request.Context()).
// 		Table("permissions").
// 		Joins("JOIN role_permissions rp ON rp.permission_id = permissions.id").
// 		Joins("JOIN roles r ON r.id = rp.role_id").
// 		Joins("JOIN user_roles ur ON ur.role_id = r.id").
// 		Where("ur.user_id = ?", userID).
// 		Where("r.tenant_id = ? OR r.tenant_id IS NULL", tenantID).
// 		Where("permissions.resource = ?", resource).
// 		Where("permissions.action = ? OR permissions.action = ?", action, string(model.ActionAdmin)).
// 		Count(&count).Error
// 	if err != nil {
// 		return false, err
// 	}
// 	return count > 0, nil
// }
// 
// func claimToString(claims map[string]any, key string) string {
// 	v, ok := claims[key]
// 	if !ok || v == nil {
// 		return ""
// 	}
// 	s, ok := v.(string)
// 	if ok {
// 		return s
// 	}
// 	return ""
// }

// -----------------------------------------------------------------------------
// FILE: internal/api/router.go
// -----------------------------------------------------------------------------
// package api
// 
// import (
// 	"encoding/json"
// 	"errors"
// 	"io"
// 	"net/http"
// 	"strconv"
// 	"strings"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/config"
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"github.com/baobaobao/baobaobaivault/internal/service"
// 	"github.com/baobaobao/baobaobaivault/internal/storage"
// 	authpkg "github.com/baobaobao/baobaobaivault/pkg/auth"
// 	"github.com/gin-gonic/gin"
// 	goredis "github.com/redis/go-redis/v9"
// 	"go.uber.org/zap"
// 	"gorm.io/gorm"
// )
// 
// type Handler struct {
// 	cfg              *config.Config
// 	db               *gorm.DB
// 	redis            *goredis.Client
// 	logger           *zap.Logger
// 	tenantService    *service.TenantService
// 	userService      *service.UserService
// 	namespaceService *service.NamespaceService
// 	storageService   *service.StorageService
// 	registry         *storage.Registry
// }
// 
// func NewRouter(cfg *config.Config, db *gorm.DB, rdb *goredis.Client, logger *zap.Logger) *gin.Engine {
// 	switch strings.ToLower(cfg.Server.Mode) {
// 	case "release":
// 		gin.SetMode(gin.ReleaseMode)
// 	case "test":
// 		gin.SetMode(gin.TestMode)
// 	default:
// 		gin.SetMode(gin.DebugMode)
// 	}
// 
// 	registry := storage.NewRegistry()
// 	h := &Handler{
// 		cfg:              cfg,
// 		db:               db,
// 		redis:            rdb,
// 		logger:           logger,
// 		tenantService:    service.NewTenantService(db, logger),
// 		userService:      service.NewUserService(db, logger, cfg.JWT.Secret),
// 		namespaceService: service.NewNamespaceService(db, logger),
// 		storageService:   service.NewStorageService(db, logger, registry),
// 		registry:         registry,
// 	}
// 
// 	authMiddleware := NewAuthMiddleware(db, h.userService)
// 
// 	r := gin.New()
// 	r.Use(gin.Recovery(), gin.Logger())
// 
// 	r.GET("/healthz", func(c *gin.Context) {
// 		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().UTC().Format(time.RFC3339)})
// 	})
// 
// 	v1 := r.Group("/api/v1")
// 	{
// 		v1.POST("/auth/login", h.login)
// 		v1.POST("/bootstrap/tenant-admin", h.bootstrapTenantAdmin)
// 
// 		authed := v1.Group("")
// 		authed.Use(authMiddleware.RequireAuth())
// 		{
// 			authed.POST("/auth/aksk", h.createAKSK)
// 			authed.GET("/auth/aksk", h.listAKSK)
// 			authed.DELETE("/auth/aksk/:id", h.revokeAKSK)
// 			authed.PUT("/users/me/password", h.changePassword)
// 
// 			authed.GET("/tenants", authMiddleware.RequirePermission("tenant", "list"), h.listTenants)
// 			authed.GET("/tenants/:id", authMiddleware.RequirePermission("tenant", "read"), h.getTenant)
// 			authed.POST("/tenants", authMiddleware.RequirePermission("tenant", "create"), h.createTenant)
// 			authed.PUT("/tenants/:id", authMiddleware.RequirePermission("tenant", "update"), h.updateTenant)
// 			authed.DELETE("/tenants/:id", authMiddleware.RequirePermission("tenant", "delete"), h.deleteTenant)
// 
// 			authed.GET("/users", authMiddleware.RequirePermission("user", "list"), h.listUsers)
// 			authed.GET("/users/:id", authMiddleware.RequirePermission("user", "read"), h.getUser)
// 			authed.POST("/users", authMiddleware.RequirePermission("user", "create"), h.createUser)
// 			authed.PUT("/users/:id", authMiddleware.RequirePermission("user", "update"), h.updateUser)
// 			authed.DELETE("/users/:id", authMiddleware.RequirePermission("user", "delete"), h.deleteUser)
// 
// 			authed.GET("/namespaces", authMiddleware.RequirePermission("namespace", "list"), h.listNamespaces)
// 			authed.GET("/namespaces/:id", authMiddleware.RequirePermission("namespace", "read"), h.getNamespace)
// 			authed.POST("/namespaces", authMiddleware.RequirePermission("namespace", "create"), h.createNamespace)
// 			authed.PUT("/namespaces/:id", authMiddleware.RequirePermission("namespace", "update"), h.updateNamespace)
// 			authed.DELETE("/namespaces/:id", authMiddleware.RequirePermission("namespace", "delete"), h.deleteNamespace)
// 
// 			authed.GET("/storage/configs", authMiddleware.RequirePermission("storage", "list"), h.listStorageConfigs)
// 			authed.POST("/storage/configs", authMiddleware.RequirePermission("storage", "create"), h.createStorageConfig)
// 			authed.DELETE("/storage/configs/:id", authMiddleware.RequirePermission("storage", "delete"), h.deleteStorageConfig)
// 
// 			authed.GET("/storage/objects", authMiddleware.RequirePermission("object", "list"), h.listObjects)
// 			authed.POST("/storage/objects/upload", authMiddleware.RequirePermission("object", "create"), h.uploadObject)
// 			authed.GET("/storage/objects/download", authMiddleware.RequirePermission("object", "read"), h.downloadObject)
// 			authed.DELETE("/storage/objects", authMiddleware.RequirePermission("object", "delete"), h.deleteObject)
// 			authed.GET("/storage/objects/presign-get", authMiddleware.RequirePermission("object", "share"), h.presignGetObject)
// 		}
// 	}
// 
// 	return r
// }
// 
// func (h *Handler) login(c *gin.Context) {
// 	var req service.LoginRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	resp, err := h.userService.Login(c.Request.Context(), req.TenantCode, req.Username, req.Password)
// 	if err != nil {
// 		jsonError(c, http.StatusUnauthorized, err)
// 		return
// 	}
// 	jsonSuccess(c, resp)
// }
// 
// type bootstrapTenantAdminRequest struct {
// 	Tenant service.CreateTenantRequest `json:"tenant" binding:"required"`
// 	Admin  struct {
// 		Username string `json:"username" binding:"required"`
// 		Email    string `json:"email" binding:"required,email"`
// 		Password string `json:"password" binding:"required,min=6"`
// 		Nickname string `json:"nickname"`
// 	} `json:"admin" binding:"required"`
// }
// 
// func (h *Handler) bootstrapTenantAdmin(c *gin.Context) {
// 	var req bootstrapTenantAdminRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	tenant, err := h.tenantService.CreateTenant(c.Request.Context(), &req.Tenant)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	var role model.Role
// 	if err := h.db.WithContext(c.Request.Context()).First(&role, "tenant_id = ? AND code = ?", tenant.ID, "tenant_admin").Error; err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 
// 	user, err := h.userService.CreateUser(c.Request.Context(), tenant.ID, &service.CreateUserRequest{
// 		Username: req.Admin.Username,
// 		Email:    req.Admin.Email,
// 		Password: req.Admin.Password,
// 		Nickname: req.Admin.Nickname,
// 		RoleIDs:  []string{role.ID},
// 	})
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	loginResp, err := h.userService.Login(c.Request.Context(), tenant.Code, req.Admin.Username, req.Admin.Password)
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 
// 	jsonCreated(c, gin.H{"tenant": tenant, "admin_user": user, "auth": loginResp})
// }
// 
// func (h *Handler) createTenant(c *gin.Context) {
// 	var req service.CreateTenantRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	tenant, err := h.tenantService.CreateTenant(c.Request.Context(), &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonCreated(c, tenant)
// }
// 
// func (h *Handler) getTenant(c *gin.Context) {
// 	tenantID := c.Param("id")
// 	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
// 		jsonError(c, http.StatusForbidden, err)
// 		return
// 	}
// 	tenant, err := h.tenantService.GetTenant(c.Request.Context(), tenantID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	jsonSuccess(c, tenant)
// }
// 
// func (h *Handler) listTenants(c *gin.Context) {
// 	currentTenantID := getTenantID(c)
// 	tenant, err := h.tenantService.GetTenant(c.Request.Context(), currentTenantID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	jsonPage(c, 1, 1, 1, []*model.Tenant{tenant})
// }
// 
// func (h *Handler) updateTenant(c *gin.Context) {
// 	tenantID := c.Param("id")
// 	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
// 		jsonError(c, http.StatusForbidden, err)
// 		return
// 	}
// 
// 	var req service.UpdateTenantRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	tenant, err := h.tenantService.UpdateTenant(c.Request.Context(), tenantID, &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, tenant)
// }
// 
// func (h *Handler) deleteTenant(c *gin.Context) {
// 	tenantID := c.Param("id")
// 	if err := h.ensureTenantOwnership(c, tenantID); err != nil {
// 		jsonError(c, http.StatusForbidden, err)
// 		return
// 	}
// 	if err := h.tenantService.DeleteTenant(c.Request.Context(), tenantID); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, gin.H{"deleted": true})
// }
// 
// func (h *Handler) createUser(c *gin.Context) {
// 	tenantID := getTenantID(c)
// 	if err := h.tenantService.CheckQuota(c.Request.Context(), tenantID, service.QuotaTypeUser); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	var req service.CreateUserRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	user, err := h.userService.CreateUser(c.Request.Context(), tenantID, &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", tenantID).
// 		Update("used_users", gorm.Expr("used_users + ?", 1)).Error
// 
// 	jsonCreated(c, user)
// }
// 
// func (h *Handler) getUser(c *gin.Context) {
// 	user, err := h.userService.GetUser(c.Request.Context(), c.Param("id"))
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if user.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 	jsonSuccess(c, user)
// }
// 
// func (h *Handler) listUsers(c *gin.Context) {
// 	page, pageSize := parsePage(c)
// 	req := service.ListUserRequest{Page: page, PageSize: pageSize, Status: c.Query("status"), Keyword: c.Query("keyword")}
// 	items, total, err := h.userService.ListUsers(c.Request.Context(), getTenantID(c), &req)
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 	jsonPage(c, total, page, pageSize, items)
// }
// 
// func (h *Handler) updateUser(c *gin.Context) {
// 	userID := c.Param("id")
// 	user, err := h.userService.GetUser(c.Request.Context(), userID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if user.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	var req service.UpdateUserRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	updated, err := h.userService.UpdateUser(c.Request.Context(), userID, &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, updated)
// }
// 
// func (h *Handler) deleteUser(c *gin.Context) {
// 	userID := c.Param("id")
// 	user, err := h.userService.GetUser(c.Request.Context(), userID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if user.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	if err := h.userService.DeleteUser(c.Request.Context(), userID); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", getTenantID(c)).
// 		Update("used_users", gorm.Expr("CASE WHEN used_users > 0 THEN used_users - 1 ELSE 0 END")).Error
// 	jsonSuccess(c, gin.H{"deleted": true})
// }
// 
// func (h *Handler) changePassword(c *gin.Context) {
// 	var req service.ChangePasswordRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	if err := h.userService.ChangePassword(c.Request.Context(), getUserID(c), req.OldPassword, req.NewPassword); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, gin.H{"changed": true})
// }
// 
// func (h *Handler) createNamespace(c *gin.Context) {
// 	tenantID := getTenantID(c)
// 	if err := h.tenantService.CheckQuota(c.Request.Context(), tenantID, service.QuotaTypeNamespace); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	var req service.CreateNamespaceRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	ns, err := h.namespaceService.CreateNamespace(c.Request.Context(), tenantID, &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", tenantID).
// 		Update("used_namespaces", gorm.Expr("used_namespaces + ?", 1)).Error
// 
// 	jsonCreated(c, ns)
// }
// 
// func (h *Handler) getNamespace(c *gin.Context) {
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), c.Param("id"))
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 	jsonSuccess(c, ns)
// }
// 
// func (h *Handler) listNamespaces(c *gin.Context) {
// 	page, pageSize := parsePage(c)
// 	req := service.ListNamespaceRequest{Page: page, PageSize: pageSize, Status: c.Query("status")}
// 	items, total, err := h.namespaceService.ListNamespaces(c.Request.Context(), getTenantID(c), &req)
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 	jsonPage(c, total, page, pageSize, items)
// }
// 
// func (h *Handler) updateNamespace(c *gin.Context) {
// 	nsID := c.Param("id")
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), nsID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	var req service.UpdateNamespaceRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	updated, err := h.namespaceService.UpdateNamespace(c.Request.Context(), nsID, &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, updated)
// }
// 
// func (h *Handler) deleteNamespace(c *gin.Context) {
// 	nsID := c.Param("id")
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), nsID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 	if err := h.namespaceService.DeleteNamespace(c.Request.Context(), nsID); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", getTenantID(c)).
// 		Update("used_namespaces", gorm.Expr("CASE WHEN used_namespaces > 0 THEN used_namespaces - 1 ELSE 0 END")).Error
// 
// 	jsonSuccess(c, gin.H{"deleted": true})
// }
// 
// func (h *Handler) createStorageConfig(c *gin.Context) {
// 	var req service.CreateStorageConfigRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	cfg, err := h.storageService.CreateStorageConfig(c.Request.Context(), getTenantID(c), &req)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonCreated(c, cfg)
// }
// 
// func (h *Handler) listStorageConfigs(c *gin.Context) {
// 	items, err := h.storageService.ListStorageConfigs(c.Request.Context(), getTenantID(c))
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 	jsonSuccess(c, items)
// }
// 
// func (h *Handler) deleteStorageConfig(c *gin.Context) {
// 	configID := c.Param("id")
// 	cfg, err := h.storageService.GetStorageConfig(c.Request.Context(), configID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if cfg.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 	if err := h.storageService.DeleteStorageConfig(c.Request.Context(), configID); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, gin.H{"deleted": true})
// }
// 
// func (h *Handler) uploadObject(c *gin.Context) {
// 	namespaceID := c.PostForm("namespace_id")
// 	key := c.PostForm("key")
// 	if namespaceID == "" || key == "" {
// 		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
// 		return
// 	}
// 
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	if err := h.tenantService.CheckQuota(c.Request.Context(), ns.TenantID, service.QuotaTypeStorage); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	file, header, err := c.Request.FormFile("file")
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, errors.New("file is required"))
// 		return
// 	}
// 	defer file.Close()
// 
// 	contentType := c.PostForm("content_type")
// 	if contentType == "" {
// 		contentType = header.Header.Get("Content-Type")
// 	}
// 	metadata := parseMetadata(c.PostForm("metadata"))
// 
// 	obj, err := h.storageService.PutObject(c.Request.Context(), namespaceID, key, file, header.Size, contentType, metadata)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", ns.TenantID).
// 		Update("used_storage", gorm.Expr("used_storage + ?", header.Size)).Error
// 
// 	jsonCreated(c, obj)
// }
// 
// func (h *Handler) downloadObject(c *gin.Context) {
// 	namespaceID := c.Query("namespace_id")
// 	key := c.Query("key")
// 	if namespaceID == "" || key == "" {
// 		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
// 		return
// 	}
// 
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	reader, obj, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	defer reader.Close()
// 
// 	if obj.ContentType != "" {
// 		c.Header("Content-Type", obj.ContentType)
// 	}
// 	c.Header("Content-Disposition", "attachment; filename=\""+obj.Name+"\"")
// 	if obj.ETag != "" {
// 		c.Header("ETag", obj.ETag)
// 	}
// 	c.Header("Content-Length", strconv.FormatInt(obj.Size, 10))
// 	_, _ = io.Copy(c.Writer, reader)
// }
// 
// func (h *Handler) deleteObject(c *gin.Context) {
// 	namespaceID := c.Query("namespace_id")
// 	key := c.Query("key")
// 	if namespaceID == "" || key == "" {
// 		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
// 		return
// 	}
// 
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	_, obj, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if err := h.storageService.DeleteObject(c.Request.Context(), namespaceID, key); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	_ = h.db.WithContext(c.Request.Context()).Model(&model.Tenant{}).
// 		Where("id = ?", ns.TenantID).
// 		Update("used_storage", gorm.Expr("CASE WHEN used_storage >= ? THEN used_storage - ? ELSE 0 END", obj.Size, obj.Size)).Error
// 
// 	jsonSuccess(c, gin.H{"deleted": true})
// }
// 
// func (h *Handler) listObjects(c *gin.Context) {
// 	namespaceID := c.Query("namespace_id")
// 	if namespaceID == "" {
// 		jsonError(c, http.StatusBadRequest, errors.New("namespace_id is required"))
// 		return
// 	}
// 
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	page, pageSize := parsePage(c)
// 	items, total, err := h.storageService.ListObjects(c.Request.Context(), namespaceID, c.Query("prefix"), page, pageSize)
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 	jsonPage(c, total, page, pageSize, items)
// }
// 
// func (h *Handler) presignGetObject(c *gin.Context) {
// 	namespaceID := c.Query("namespace_id")
// 	key := c.Query("key")
// 	if namespaceID == "" || key == "" {
// 		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
// 		return
// 	}
// 
// 	ns, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
// 	if err != nil {
// 		jsonError(c, http.StatusNotFound, err)
// 		return
// 	}
// 	if ns.TenantID != getTenantID(c) {
// 		jsonError(c, http.StatusForbidden, errors.New("cross-tenant access denied"))
// 		return
// 	}
// 
// 	ttlSeconds := int64(300)
// 	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
// 		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 && value <= 3600 {
// 			ttlSeconds = value
// 		}
// 	}
// 
// 	url, err := h.storageService.PresignGetObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
// 	if err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 	jsonSuccess(c, gin.H{"url": url, "ttl_seconds": ttlSeconds})
// }
// 
// type createAKSKRequest struct {
// 	Description   string `json:"description"`
// 	ExpiresInDays int    `json:"expires_in_days"`
// }
// 
// func (h *Handler) createAKSK(c *gin.Context) {
// 	var req createAKSKRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		jsonError(c, http.StatusBadRequest, err)
// 		return
// 	}
// 
// 	accessKey, secretKey, err := authpkg.GenerateAKSK()
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 
// 	var expiresAt *time.Time
// 	if req.ExpiresInDays > 0 {
// 		t := time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour)
// 		expiresAt = &t
// 	}
// 
// 	record := &model.AKSK{
// 		TenantID:    getTenantID(c),
// 		UserID:      getUserID(c),
// 		AccessKey:   accessKey,
// 		SecretKey:   secretKey,
// 		Description: req.Description,
// 		Status:      model.AKSKStatusActive,
// 		ExpiresAt:   expiresAt,
// 	}
// 	if err := h.db.WithContext(c.Request.Context()).Create(record).Error; err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 
// 	jsonCreated(c, gin.H{
// 		"id":          record.ID,
// 		"access_key":  accessKey,
// 		"secret_key":  secretKey,
// 		"expires_at":  expiresAt,
// 		"description": record.Description,
// 	})
// }
// 
// func (h *Handler) listAKSK(c *gin.Context) {
// 	var records []model.AKSK
// 	err := h.db.WithContext(c.Request.Context()).
// 		Where("tenant_id = ? AND user_id = ?", getTenantID(c), getUserID(c)).
// 		Order("created_at DESC").
// 		Find(&records).Error
// 	if err != nil {
// 		jsonError(c, http.StatusInternalServerError, err)
// 		return
// 	}
// 
// 	items := make([]gin.H, 0, len(records))
// 	for _, item := range records {
// 		items = append(items, gin.H{
// 			"id":          item.ID,
// 			"access_key":  item.AccessKey,
// 			"description": item.Description,
// 			"status":      item.Status,
// 			"expires_at":  item.ExpiresAt,
// 			"created_at":  item.CreatedAt,
// 		})
// 	}
// 	jsonSuccess(c, items)
// }
// 
// func (h *Handler) revokeAKSK(c *gin.Context) {
// 	id := c.Param("id")
// 	result := h.db.WithContext(c.Request.Context()).Model(&model.AKSK{}).
// 		Where("id = ? AND tenant_id = ? AND user_id = ?", id, getTenantID(c), getUserID(c)).
// 		Update("status", model.AKSKStatusRevoked)
// 	if result.Error != nil {
// 		jsonError(c, http.StatusInternalServerError, result.Error)
// 		return
// 	}
// 	if result.RowsAffected == 0 {
// 		jsonError(c, http.StatusNotFound, errors.New("aksk not found"))
// 		return
// 	}
// 	jsonSuccess(c, gin.H{"revoked": true})
// }
// 
// func (h *Handler) ensureTenantOwnership(c *gin.Context, tenantID string) error {
// 	if tenantID == "" {
// 		return errors.New("tenant id is required")
// 	}
// 	if tenantID != getTenantID(c) {
// 		return errors.New("cross-tenant access denied")
// 	}
// 	return nil
// }
// 
// func parsePage(c *gin.Context) (page, pageSize int) {
// 	page = 1
// 	pageSize = 20
// 	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
// 		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
// 			page = v
// 		}
// 	}
// 	if raw := strings.TrimSpace(c.Query("page_size")); raw != "" {
// 		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 100 {
// 			pageSize = v
// 		}
// 	}
// 	return
// }
// 
// func parseMetadata(value string) map[string]string {
// 	value = strings.TrimSpace(value)
// 	if value == "" {
// 		return nil
// 	}
// 	var metadata map[string]string
// 	if err := json.Unmarshal([]byte(value), &metadata); err != nil {
// 		return nil
// 	}
// 	return metadata
// }

// -----------------------------------------------------------------------------
// FILE: internal/config/config.go
// -----------------------------------------------------------------------------
// package config
// 
// import (
// 	"fmt"
// 	"time"
// 
// 	"github.com/spf13/viper"
// )
// 
// type Config struct {
// 	Server   ServerConfig   `mapstructure:"server"`
// 	Database DatabaseConfig `mapstructure:"database"`
// 	Redis    RedisConfig    `mapstructure:"redis"`
// 	JWT      JWTConfig      `mapstructure:"jwt"`
// 	Storage  StorageConfig  `mapstructure:"storage"`
// 	Log      LogConfig      `mapstructure:"log"`
// }
// 
// type ServerConfig struct {
// 	Port         string `mapstructure:"port"`
// 	ReadTimeout  int    `mapstructure:"read_timeout"`
// 	WriteTimeout int    `mapstructure:"write_timeout"`
// 	Mode         string `mapstructure:"mode"` // debug, release, test
// }
// 
// type DatabaseConfig struct {
// 	Host            string `mapstructure:"host"`
// 	Port            int    `mapstructure:"port"`
// 	User            string `mapstructure:"user"`
// 	Password        string `mapstructure:"password"`
// 	DBName          string `mapstructure:"dbname"`
// 	SSLMode         string `mapstructure:"sslmode"`
// 	MaxOpenConns    int    `mapstructure:"max_open_conns"`
// 	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
// 	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
// }
// 
// func (d DatabaseConfig) DSN() string {
// 	return fmt.Sprintf(
// 		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
// 		d.Host,
// 		d.Port,
// 		d.User,
// 		d.Password,
// 		d.DBName,
// 		d.SSLMode,
// 	)
// }
// 
// type RedisConfig struct {
// 	Host     string `mapstructure:"host"`
// 	Port     int    `mapstructure:"port"`
// 	Password string `mapstructure:"password"`
// 	DB       int    `mapstructure:"db"`
// }
// 
// type JWTConfig struct {
// 	Secret     string        `mapstructure:"secret"`
// 	ExpireTime time.Duration `mapstructure:"expire_time"`
// 	Issuer     string        `mapstructure:"issuer"`
// }
// 
// type StorageConfig struct {
// 	DefaultProvider string `mapstructure:"default_provider"`
// 	TempDir         string `mapstructure:"temp_dir"`
// 	MaxFileSize     int64  `mapstructure:"max_file_size"` // bytes
// }
// 
// type LogConfig struct {
// 	Level  string `mapstructure:"level"`
// 	Format string `mapstructure:"format"` // json, console
// }
// 
// // Load 鍔犺浇閰嶇疆鏂囦欢
// func Load() (*Config, error) {
// 	viper.SetConfigName("config")
// 	viper.SetConfigType("yaml")
// 	viper.AddConfigPath(".")
// 	viper.AddConfigPath("./config")
// 	viper.AddConfigPath("/etc/baobaobaivault")
// 
// 	// 鐜鍙橀噺
// 	viper.AutomaticEnv()
// 	viper.SetEnvPrefix("BVAULT")
// 
// 	// 榛樿鍊?	setDefaults()
// 
// 	if err := viper.ReadInConfig(); err != nil {
// 		return nil, err
// 	}
// 
// 	var cfg Config
// 	if err := viper.Unmarshal(&cfg); err != nil {
// 		return nil, err
// 	}
// 
// 	return &cfg, nil
// }
// 
// func setDefaults() {
// 	// Server
// 	viper.SetDefault("server.port", "8080")
// 	viper.SetDefault("server.read_timeout", 30)
// 	viper.SetDefault("server.write_timeout", 30)
// 	viper.SetDefault("server.mode", "debug")
// 
// 	// Database
// 	viper.SetDefault("database.host", "localhost")
// 	viper.SetDefault("database.port", 5432)
// 	viper.SetDefault("database.user", "postgres")
// 	viper.SetDefault("database.password", "postgres")
// 	viper.SetDefault("database.dbname", "baobaobaivault")
// 	viper.SetDefault("database.sslmode", "disable")
// 	viper.SetDefault("database.max_open_conns", 100)
// 	viper.SetDefault("database.max_idle_conns", 10)
// 	viper.SetDefault("database.conn_max_lifetime", 3600)
// 
// 	// Redis
// 	viper.SetDefault("redis.host", "localhost")
// 	viper.SetDefault("redis.port", 6379)
// 	viper.SetDefault("redis.password", "")
// 	viper.SetDefault("redis.db", 0)
// 
// 	// JWT
// 	viper.SetDefault("jwt.secret", "your-secret-key-change-in-production")
// 	viper.SetDefault("jwt.expire_time", "24h")
// 	viper.SetDefault("jwt.issuer", "baobaobaivault")
// 
// 	// Storage
// 	viper.SetDefault("storage.default_provider", "local")
// 	viper.SetDefault("storage.temp_dir", "/tmp/baobaobaivault")
// 	viper.SetDefault("storage.max_file_size", 10737418240) // 10GB
// 
// 	// Log
// 	viper.SetDefault("log.level", "info")
// 	viper.SetDefault("log.format", "json")
// }

// -----------------------------------------------------------------------------
// FILE: internal/model/storage.go
// -----------------------------------------------------------------------------
// package model
// 
// import (
// 	"time"
// 
// 	"gorm.io/gorm"
// )
// 
// // StorageConfig 瀛樺偍閰嶇疆琛紙姣忎釜绉熸埛鍙厤缃涓瓨鍌ㄥ悗绔級
// type StorageConfig struct {
// 	ID          string              `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID    string              `gorm:"type:uuid;not null;index" json:"tenant_id"`
// 	Name        string              `gorm:"type:varchar(100);not null" json:"name"`
// 	Provider    StorageProvider     `gorm:"type:varchar(50);not null" json:"provider"`
// 	Endpoint    string              `gorm:"type:varchar(255)" json:"endpoint"`
// 	Region      string              `gorm:"type:varchar(50)" json:"region"`
// 	Bucket      string              `gorm:"type:varchar(100)" json:"bucket"`
// 	AccessKey   string              `gorm:"type:varchar(100)" json:"-"`      // 鍔犲瘑瀛樺偍
// 	SecretKey   string              `gorm:"type:varchar(255)" json:"-"`      // 鍔犲瘑瀛樺偍
// 	PathStyle   bool                `gorm:"default:false" json:"path_style"` // 鏄惁浣跨敤 path-style URL
// 	IsDefault   bool                `gorm:"default:false" json:"is_default"`
// 	Status      StorageConfigStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
// 	ExtraConfig string              `gorm:"type:text" json:"extra_config"` // JSON 鏍煎紡鐨勯澶栭厤缃?
// 	// 缁熻淇℃伅
// 	UsedStorage int64 `gorm:"default:0" json:"used_storage"`
// 	ObjectCount int64 `gorm:"default:0" json:"object_count"`
// 
// 	CreatedAt time.Time      `json:"created_at"`
// 	UpdatedAt time.Time      `json:"updated_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Tenant     *Tenant     `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	Namespaces []Namespace `gorm:"foreignKey:StorageConfigID" json:"namespaces,omitempty"`
// }
// 
// type StorageProvider string
// 
// const (
// 	ProviderS3     StorageProvider = "s3"
// 	ProviderOSS    StorageProvider = "oss"
// 	ProviderCOS    StorageProvider = "cos"
// 	ProviderMinio  StorageProvider = "minio"
// 	ProviderGCS    StorageProvider = "gcs"
// 	ProviderAzure  StorageProvider = "azure"
// 	ProviderLocal  StorageProvider = "local"
// 	ProviderWebDAV StorageProvider = "webdav"
// )
// 
// type StorageConfigStatus string
// 
// const (
// 	StorageConfigStatusActive   StorageConfigStatus = "active"
// 	StorageConfigStatusInactive StorageConfigStatus = "inactive"
// 	StorageConfigStatusError    StorageConfigStatus = "error"
// )
// 
// func (StorageConfig) TableName() string {
// 	return "storage_configs"
// }
// 
// // Object 瀵硅薄琛紙鏂囦欢鍏冩暟鎹級
// type Object struct {
// 	ID          string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	NamespaceID string `gorm:"type:uuid;not null;index" json:"namespace_id"`
// 	Key         string `gorm:"type:varchar(1024);not null;index:idx_object_key,namespace_id" json:"key"` // 瀵硅薄璺緞
// 	Name        string `gorm:"type:varchar(255)" json:"name"`                                            // 鏂囦欢鍚?	Size        int64  `gorm:"not null" json:"size"`
// 	ContentType string `gorm:"type:varchar(100)" json:"content_type"`
// 	ETag        string `gorm:"type:varchar(64)" json:"etag"` // MD5
// 	VersionID   string `gorm:"type:varchar(64)" json:"version_id"`
// 
// 	// 瀛樺偍淇℃伅
// 	StorageKey   string `gorm:"type:varchar(1024)" json:"storage_key"` // 瀹為檯瀛樺偍璺緞
// 	StorageClass string `gorm:"type:varchar(20)" json:"storage_class"`
// 
// 	// 鍏冩暟鎹?	Metadata     string `gorm:"type:text" json:"metadata"`      // JSON 鏍煎紡
// 	UserMetadata string `gorm:"type:text" json:"user_metadata"` // 鐢ㄦ埛鑷畾涔夊厓鏁版嵁
// 
// 	// 鐗堟湰鎺у埗
// 	IsLatest  bool `gorm:"default:true" json:"is_latest"`
// 	IsDeleted bool `gorm:"default:false" json:"is_deleted"` // 杞垹闄ゆ爣璁?
// 	// 鏃堕棿鎴?	LastModified time.Time      `json:"last_modified"`
// 	CreatedAt    time.Time      `json:"created_at"`
// 	UpdatedAt    time.Time      `json:"updated_at"`
// 	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Namespace *Namespace      `gorm:"foreignKey:NamespaceID" json:"namespace,omitempty"`
// 	Versions  []ObjectVersion `gorm:"foreignKey:ObjectID" json:"versions,omitempty"`
// }
// 
// func (Object) TableName() string {
// 	return "objects"
// }
// 
// // ObjectVersion 瀵硅薄鐗堟湰琛?type ObjectVersion struct {
// 	ID         string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	ObjectID   string `gorm:"type:uuid;not null;index" json:"object_id"`
// 	VersionID  string `gorm:"type:varchar(64);not null" json:"version_id"`
// 	Size       int64  `gorm:"not null" json:"size"`
// 	ETag       string `gorm:"type:varchar(64)" json:"etag"`
// 	StorageKey string `gorm:"type:varchar(1024)" json:"storage_key"`
// 	IsLatest   bool   `gorm:"default:false" json:"is_latest"`
// 
// 	CreatedAt time.Time      `json:"created_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Object *Object `gorm:"foreignKey:ObjectID" json:"object,omitempty"`
// }
// 
// func (ObjectVersion) TableName() string {
// 	return "object_versions"
// }
// 
// // AuditLog 瀹¤鏃ュ織琛?type AuditLog struct {
// 	ID         string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID   string  `gorm:"type:uuid;not null;index" json:"tenant_id"`
// 	UserID     *string `gorm:"type:uuid;index" json:"user_id"`
// 	Action     string  `gorm:"type:varchar(50);not null;index" json:"action"`
// 	Resource   string  `gorm:"type:varchar(100);not null" json:"resource"`
// 	ResourceID string  `gorm:"type:varchar(100);index" json:"resource_id"`
// 	Detail     string  `gorm:"type:text" json:"detail"` // JSON 鏍煎紡鐨勮缁嗕俊鎭?	IPAddress  string  `gorm:"type:varchar(50)" json:"ip_address"`
// 	UserAgent  string  `gorm:"type:varchar(500)" json:"user_agent"`
// 	Status     string  `gorm:"type:varchar(20)" json:"status"` // success, failed
// 
// 	CreatedAt time.Time `gorm:"index" json:"created_at"`
// 
// 	// 鍏宠仈
// 	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	User   *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
// }
// 
// func (AuditLog) TableName() string {
// 	return "audit_logs"
// }

// -----------------------------------------------------------------------------
// FILE: internal/model/tenant.go
// -----------------------------------------------------------------------------
// package model
// 
// import (
// 	"time"
// 
// 	"gorm.io/gorm"
// )
// 
// // Tenant 绉熸埛琛?type Tenant struct {
// 	ID          string       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	Name        string       `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
// 	Code        string       `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"` // 绉熸埛鍞竴鏍囪瘑
// 	Description string       `gorm:"type:text" json:"description"`
// 	Status      TenantStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
// 	Plan        TenantPlan   `gorm:"type:varchar(20);default:'free'" json:"plan"`
// 
// 	// 閰嶉
// 	MaxStorage     int64 `gorm:"default:10737418240" json:"max_storage"` // 鏈€澶у瓨鍌ㄧ┖闂?(bytes), 榛樿10GB
// 	MaxNamespaces  int   `gorm:"default:10" json:"max_namespaces"`       // 鏈€澶у懡鍚嶇┖闂存暟
// 	MaxUsers       int   `gorm:"default:100" json:"max_users"`           // 鏈€澶х敤鎴锋暟
// 	MaxAPICalls    int64 `gorm:"default:100000" json:"max_api_calls"`    // 姣忔棩鏈€澶PI璋冪敤娆℃暟
// 	UsedStorage    int64 `gorm:"default:0" json:"used_storage"`          // 宸茬敤瀛樺偍绌洪棿
// 	UsedNamespaces int   `gorm:"default:0" json:"used_namespaces"`       // 宸茬敤鍛藉悕绌洪棿鏁?	UsedUsers      int   `gorm:"default:0" json:"used_users"`            // 宸茬敤鐢ㄦ埛鏁?	UsedAPICalls   int64 `gorm:"default:0" json:"used_api_calls"`        // 浠婃棩API璋冪敤娆℃暟
// 
// 	// 鏃堕棿鎴?	CreatedAt time.Time      `json:"created_at"`
// 	UpdatedAt time.Time      `json:"updated_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Namespaces     []Namespace     `gorm:"foreignKey:TenantID" json:"namespaces,omitempty"`
// 	Users          []User          `gorm:"foreignKey:TenantID" json:"users,omitempty"`
// 	StorageConfigs []StorageConfig `gorm:"foreignKey:TenantID" json:"storage_configs,omitempty"`
// 	AKSKs          []AKSK          `gorm:"foreignKey:TenantID" json:"ak_sks,omitempty"`
// }
// 
// type TenantStatus string
// 
// const (
// 	TenantStatusActive    TenantStatus = "active"
// 	TenantStatusSuspended TenantStatus = "suspended"
// 	TenantStatusDeleted   TenantStatus = "deleted"
// )
// 
// type TenantPlan string
// 
// const (
// 	TenantPlanFree       TenantPlan = "free"
// 	TenantPlanBasic      TenantPlan = "basic"
// 	TenantPlanPro        TenantPlan = "pro"
// 	TenantPlanEnterprise TenantPlan = "enterprise"
// )
// 
// // TableName 鎸囧畾琛ㄥ悕
// func (Tenant) TableName() string {
// 	return "tenants"
// }
// 
// // Namespace 鍛藉悕绌洪棿锛堝瓨鍌ㄦ《绾у埆锛?type Namespace struct {
// 	ID          string   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID    string   `gorm:"type:uuid;not null;index" json:"tenant_id"`
// 	Name        string   `gorm:"type:varchar(100);not null;index:idx_ns_tenant_name,tenant_id" json:"name"`
// 	Description string   `gorm:"type:text" json:"description"`
// 	Status      NSStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
// 	IsDefault   bool     `gorm:"default:false" json:"is_default"`
// 
// 	// 瀛樺偍閰嶇疆
// 	StorageConfigID string `gorm:"type:uuid" json:"storage_config_id"`
// 	PathPrefix      string `gorm:"type:varchar(500)" json:"path_prefix"` // 瀛樺偍璺緞鍓嶇紑
// 
// 	// 閰嶉锛堝彲瑕嗙洊绉熸埛閰嶉锛?	MaxStorage  *int64 `gorm:"" json:"max_storage,omitempty"`
// 	MaxFiles    *int   `gorm:"" json:"max_files,omitempty"`
// 	MaxFileSize *int64 `gorm:"" json:"max_file_size,omitempty"`
// 	UsedStorage int64  `gorm:"default:0" json:"used_storage"`
// 	UsedFiles   int    `gorm:"default:0" json:"used_files"`
// 
// 	// 鏃堕棿鎴?	CreatedAt time.Time      `json:"created_at"`
// 	UpdatedAt time.Time      `json:"updated_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Tenant        *Tenant        `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	StorageConfig *StorageConfig `gorm:"foreignKey:StorageConfigID" json:"storage_config,omitempty"`
// 	Objects       []Object       `gorm:"foreignKey:NamespaceID" json:"objects,omitempty"`
// }
// 
// type NSStatus string
// 
// const (
// 	NSStatusActive   NSStatus = "active"
// 	NSStatusArchived NSStatus = "archived"
// )
// 
// func (Namespace) TableName() string {
// 	return "namespaces"
// }

// -----------------------------------------------------------------------------
// FILE: internal/model/user.go
// -----------------------------------------------------------------------------
// package model
// 
// import (
// 	"time"
// 
// 	"golang.org/x/crypto/bcrypt"
// 	"gorm.io/gorm"
// )
// 
// // User 鐢ㄦ埛琛?type User struct {
// 	ID       string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID string     `gorm:"type:uuid;not null;index" json:"tenant_id"`
// 	Username string     `gorm:"type:varchar(50);not null;index:idx_user_tenant_username,tenant_id" json:"username"`
// 	Email    string     `gorm:"type:varchar(100);not null;index:idx_user_tenant_email,tenant_id" json:"email"`
// 	Password string     `gorm:"type:varchar(255);not null" json:"-"`
// 	Nickname string     `gorm:"type:varchar(100)" json:"nickname"`
// 	Avatar   string     `gorm:"type:varchar(500)" json:"avatar"`
// 	Status   UserStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
// 
// 	// 鏃堕棿鎴?	LastLoginAt *time.Time     `json:"last_login_at,omitempty"`
// 	CreatedAt   time.Time      `json:"created_at"`
// 	UpdatedAt   time.Time      `json:"updated_at"`
// 	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Tenant    *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	Roles     []Role     `gorm:"many2many:user_roles;" json:"roles,omitempty"`
// 	AKSKs     []AKSK     `gorm:"foreignKey:UserID" json:"ak_sks,omitempty"`
// 	AuditLogs []AuditLog `gorm:"foreignKey:UserID" json:"audit_logs,omitempty"`
// }
// 
// type UserStatus string
// 
// const (
// 	UserStatusActive   UserStatus = "active"
// 	UserStatusInactive UserStatus = "inactive"
// 	UserStatusLocked   UserStatus = "locked"
// )
// 
// func (User) TableName() string {
// 	return "users"
// }
// 
// // SetPassword 璁剧疆瀵嗙爜锛堝姞瀵嗭級
// func (u *User) SetPassword(password string) error {
// 	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
// 	if err != nil {
// 		return err
// 	}
// 	u.Password = string(hashedPassword)
// 	return nil
// }
// 
// // CheckPassword 楠岃瘉瀵嗙爜
// func (u *User) CheckPassword(password string) bool {
// 	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
// 	return err == nil
// }
// 
// // Role 瑙掕壊琛?type Role struct {
// 	ID          string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID    *string `gorm:"type:uuid;index" json:"tenant_id"` // nil 琛ㄧず绯荤粺鍐呯疆瑙掕壊
// 	Code        string  `gorm:"type:varchar(50);not null;uniqueIndex:idx_role_code,tenant_id" json:"code"`
// 	Name        string  `gorm:"type:varchar(100);not null" json:"name"`
// 	Description string  `gorm:"type:text" json:"description"`
// 	IsSystem    bool    `gorm:"default:false" json:"is_system"` // 鏄惁绯荤粺鍐呯疆瑙掕壊
// 	Level       int     `gorm:"default:0" json:"level"`         // 瑙掕壊灞傜骇锛岃秺澶ф潈闄愯秺楂?
// 	CreatedAt time.Time `json:"created_at"`
// 	UpdatedAt time.Time `json:"updated_at"`
// 
// 	// 鍏宠仈
// 	Tenant      *Tenant      `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	Permissions []Permission `gorm:"many2many:role_permissions;" json:"permissions,omitempty"`
// 	Users       []User       `gorm:"many2many:user_roles;" json:"users,omitempty"`
// }
// 
// func (Role) TableName() string {
// 	return "roles"
// }
// 
// // Permission 鏉冮檺琛?type Permission struct {
// 	ID          string           `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	Code        string           `gorm:"type:varchar(100);not null;uniqueIndex" json:"code"`
// 	Name        string           `gorm:"type:varchar(100);not null" json:"name"`
// 	Description string           `gorm:"type:text" json:"description"`
// 	Resource    string           `gorm:"type:varchar(100);not null" json:"resource"` // 璧勬簮绫诲瀷: tenant, user, namespace, object
// 	Action      PermissionAction `gorm:"type:varchar(20);not null" json:"action"`    // 鎿嶄綔绫诲瀷: create, read, update, delete, list
// 
// 	CreatedAt time.Time `json:"created_at"`
// 	UpdatedAt time.Time `json:"updated_at"`
// 
// 	// 鍏宠仈
// 	Roles []Role `gorm:"many2many:role_permissions;" json:"roles,omitempty"`
// }
// 
// type PermissionAction string
// 
// const (
// 	ActionCreate PermissionAction = "create"
// 	ActionRead   PermissionAction = "read"
// 	ActionUpdate PermissionAction = "update"
// 	ActionDelete PermissionAction = "delete"
// 	ActionList   PermissionAction = "list"
// 	ActionShare  PermissionAction = "share"
// 	ActionAdmin  PermissionAction = "admin"
// )
// 
// func (Permission) TableName() string {
// 	return "permissions"
// }
// 
// // AKSK AccessKey/SecretKey 琛?type AKSK struct {
// 	ID          string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	TenantID    string     `gorm:"type:uuid;not null;index" json:"tenant_id"`
// 	UserID      string     `gorm:"type:uuid;not null;index" json:"user_id"`
// 	AccessKey   string     `gorm:"type:varchar(50);not null;uniqueIndex" json:"access_key"`
// 	SecretKey   string     `gorm:"type:varchar(100);not null" json:"-"` // 鍔犲瘑瀛樺偍锛屼笉杩斿洖缁欏墠绔?	Description string     `gorm:"type:text" json:"description"`
// 	Status      AKSKStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
// 	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
// 
// 	CreatedAt time.Time      `json:"created_at"`
// 	UpdatedAt time.Time      `json:"updated_at"`
// 	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
// 
// 	// 鍏宠仈
// 	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
// 	User   *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
// }
// 
// type AKSKStatus string
// 
// const (
// 	AKSKStatusActive  AKSKStatus = "active"
// 	AKSKStatusRevoked AKSKStatus = "revoked"
// 	AKSKStatusExpired AKSKStatus = "expired"
// )
// 
// func (AKSK) TableName() string {
// 	return "ak_sks"
// }

// -----------------------------------------------------------------------------
// FILE: internal/service/namespace_service.go
// -----------------------------------------------------------------------------
// package service
// 
// import (
// 	"context"
// 	"errors"
// 	"fmt"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"go.uber.org/zap"
// 	"gorm.io/gorm"
// )
// 
// // NamespaceService 鍛藉悕绌洪棿鏈嶅姟
// type NamespaceService struct {
// 	db     *gorm.DB
// 	logger *zap.Logger
// }
// 
// // NewNamespaceService 鍒涘缓鍛藉悕绌洪棿鏈嶅姟
// func NewNamespaceService(db *gorm.DB, logger *zap.Logger) *NamespaceService {
// 	return &NamespaceService{
// 		db:     db,
// 		logger: logger,
// 	}
// }
// 
// // CreateNamespace 鍒涘缓鍛藉悕绌洪棿
// func (s *NamespaceService) CreateNamespace(ctx context.Context, tenantID string, req *CreateNamespaceRequest) (*model.Namespace, error) {
// 	// 妫€鏌ュ懡鍚嶇┖闂村悕绉版槸鍚﹀凡瀛樺湪
// 	var count int64
// 	if err := s.db.Model(&model.Namespace{}).Where("tenant_id = ? AND name = ?", tenantID, req.Name).Count(&count).Error; err != nil {
// 		return nil, fmt.Errorf("failed to check namespace name: %w", err)
// 	}
// 	if count > 0 {
// 		return nil, errors.New("namespace name already exists")
// 	}
// 
// 	ns := &model.Namespace{
// 		TenantID:        tenantID,
// 		Name:            req.Name,
// 		Description:     req.Description,
// 		Status:          model.NSStatusActive,
// 		StorageConfigID: req.StorageConfigID,
// 		PathPrefix:      req.PathPrefix,
// 	}
// 
// 	if err := s.db.Create(ns).Error; err != nil {
// 		return nil, fmt.Errorf("failed to create namespace: %w", err)
// 	}
// 
// 	s.logger.Info("Namespace created",
// 		zap.String("namespace_id", ns.ID),
// 		zap.String("tenant_id", tenantID),
// 		zap.String("name", ns.Name),
// 	)
// 
// 	return ns, nil
// }
// 
// // GetNamespace 鑾峰彇鍛藉悕绌洪棿
// func (s *NamespaceService) GetNamespace(ctx context.Context, namespaceID string) (*model.Namespace, error) {
// 	var ns model.Namespace
// 	if err := s.db.Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("namespace not found")
// 		}
// 		return nil, fmt.Errorf("failed to get namespace: %w", err)
// 	}
// 	return &ns, nil
// }
// 
// // ListNamespaces 鍒楀嚭鍛藉悕绌洪棿
// func (s *NamespaceService) ListNamespaces(ctx context.Context, tenantID string, req *ListNamespaceRequest) ([]*model.Namespace, int64, error) {
// 	var namespaces []*model.Namespace
// 	var total int64
// 
// 	query := s.db.Model(&model.Namespace{}).Where("tenant_id = ?", tenantID)
// 
// 	if req.Status != "" {
// 		query = query.Where("status = ?", req.Status)
// 	}
// 
// 	if err := query.Count(&total).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to count namespaces: %w", err)
// 	}
// 
// 	offset := (req.Page - 1) * req.PageSize
// 	if err := query.Preload("StorageConfig").Offset(offset).Limit(req.PageSize).Find(&namespaces).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to list namespaces: %w", err)
// 	}
// 
// 	return namespaces, total, nil
// }
// 
// // UpdateNamespace 鏇存柊鍛藉悕绌洪棿
// func (s *NamespaceService) UpdateNamespace(ctx context.Context, namespaceID string, req *UpdateNamespaceRequest) (*model.Namespace, error) {
// 	ns, err := s.GetNamespace(ctx, namespaceID)
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	updates := make(map[string]interface{})
// 	if req.Description != "" {
// 		updates["description"] = req.Description
// 	}
// 	if req.Status != "" {
// 		updates["status"] = req.Status
// 	}
// 	if req.StorageConfigID != "" {
// 		updates["storage_config_id"] = req.StorageConfigID
// 	}
// 	if req.PathPrefix != "" {
// 		updates["path_prefix"] = req.PathPrefix
// 	}
// 
// 	if len(updates) > 0 {
// 		if err := s.db.Model(ns).Updates(updates).Error; err != nil {
// 			return nil, fmt.Errorf("failed to update namespace: %w", err)
// 		}
// 	}
// 
// 	return ns, nil
// }
// 
// // DeleteNamespace 鍒犻櫎鍛藉悕绌洪棿
// func (s *NamespaceService) DeleteNamespace(ctx context.Context, namespaceID string) error {
// 	// 妫€鏌ユ槸鍚︽湁瀵硅薄
// 	var count int64
// 	if err := s.db.Model(&model.Object{}).Where("namespace_id = ?", namespaceID).Count(&count).Error; err != nil {
// 		return fmt.Errorf("failed to check objects: %w", err)
// 	}
// 	if count > 0 {
// 		return errors.New("namespace is not empty, please delete objects first")
// 	}
// 
// 	result := s.db.Delete(&model.Namespace{}, "id = ?", namespaceID)
// 	if result.Error != nil {
// 		return fmt.Errorf("failed to delete namespace: %w", result.Error)
// 	}
// 	if result.RowsAffected == 0 {
// 		return errors.New("namespace not found")
// 	}
// 
// 	s.logger.Info("Namespace deleted", zap.String("namespace_id", namespaceID))
// 	return nil
// }
// 
// // DTO 瀹氫箟
// 
// type CreateNamespaceRequest struct {
// 	Name            string `json:"name" binding:"required"`
// 	Description     string `json:"description"`
// 	StorageConfigID string `json:"storage_config_id"`
// 	PathPrefix      string `json:"path_prefix"`
// }
// 
// type UpdateNamespaceRequest struct {
// 	Description     string `json:"description"`
// 	Status          string `json:"status"`
// 	StorageConfigID string `json:"storage_config_id"`
// 	PathPrefix      string `json:"path_prefix"`
// }
// 
// type ListNamespaceRequest struct {
// 	Page     int    `form:"page"`
// 	PageSize int    `form:"page_size"`
// 	Status   string `form:"status"`
// }

// -----------------------------------------------------------------------------
// FILE: internal/service/storage_service.go
// -----------------------------------------------------------------------------
// package service
// 
// import (
// 	"context"
// 	"encoding/json"
// 	"errors"
// 	"fmt"
// 	"io"
// 	"path/filepath"
// 	"strings"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"github.com/baobaobao/baobaobaivault/internal/storage"
// 	"go.uber.org/zap"
// 	"gorm.io/gorm"
// )
// 
// // StorageService provides storage config and object operations.
// type StorageService struct {
// 	db       *gorm.DB
// 	logger   *zap.Logger
// 	registry *storage.Registry
// }
// 
// func NewStorageService(db *gorm.DB, logger *zap.Logger, registry *storage.Registry) *StorageService {
// 	return &StorageService{db: db, logger: logger, registry: registry}
// }
// 
// func (s *StorageService) CreateStorageConfig(ctx context.Context, tenantID string, req *CreateStorageConfigRequest) (*model.StorageConfig, error) {
// 	provider := strings.ToLower(req.Provider)
// 	if provider == "" {
// 		return nil, errors.New("provider is required")
// 	}
// 
// 	config := &model.StorageConfig{
// 		TenantID:    tenantID,
// 		Name:        req.Name,
// 		Provider:    model.StorageProvider(provider),
// 		Endpoint:    req.Endpoint,
// 		Region:      req.Region,
// 		Bucket:      req.Bucket,
// 		AccessKey:   req.AccessKey,
// 		SecretKey:   req.SecretKey,
// 		PathStyle:   req.PathStyle,
// 		IsDefault:   req.IsDefault,
// 		Status:      model.StorageConfigStatusActive,
// 		ExtraConfig: req.ExtraConfig,
// 	}
// 
// 	if err := s.db.WithContext(ctx).Create(config).Error; err != nil {
// 		return nil, fmt.Errorf("failed to create storage config: %w", err)
// 	}
// 
// 	if config.IsDefault {
// 		_ = s.db.WithContext(ctx).Model(&model.StorageConfig{}).
// 			Where("tenant_id = ? AND id != ?", tenantID, config.ID).
// 			Update("is_default", false).Error
// 	}
// 
// 	s.logger.Info("Storage config created",
// 		zap.String("config_id", config.ID),
// 		zap.String("tenant_id", tenantID),
// 		zap.String("provider", string(config.Provider)),
// 	)
// 
// 	return config, nil
// }
// 
// func (s *StorageService) GetStorageConfig(ctx context.Context, configID string) (*model.StorageConfig, error) {
// 	var config model.StorageConfig
// 	if err := s.db.WithContext(ctx).First(&config, "id = ?", configID).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("storage config not found")
// 		}
// 		return nil, fmt.Errorf("failed to get storage config: %w", err)
// 	}
// 	return &config, nil
// }
// 
// func (s *StorageService) ListStorageConfigs(ctx context.Context, tenantID string) ([]*model.StorageConfig, error) {
// 	var configs []*model.StorageConfig
// 	if err := s.db.WithContext(ctx).Find(&configs, "tenant_id = ?", tenantID).Error; err != nil {
// 		return nil, fmt.Errorf("failed to list storage configs: %w", err)
// 	}
// 	return configs, nil
// }
// 
// func (s *StorageService) DeleteStorageConfig(ctx context.Context, configID string) error {
// 	var count int64
// 	if err := s.db.WithContext(ctx).Model(&model.Namespace{}).
// 		Where("storage_config_id = ?", configID).
// 		Count(&count).Error; err != nil {
// 		return fmt.Errorf("failed to check namespaces: %w", err)
// 	}
// 	if count > 0 {
// 		return errors.New("storage config is in use by namespaces")
// 	}
// 
// 	result := s.db.WithContext(ctx).Delete(&model.StorageConfig{}, "id = ?", configID)
// 	if result.Error != nil {
// 		return fmt.Errorf("failed to delete storage config: %w", result.Error)
// 	}
// 	if result.RowsAffected == 0 {
// 		return errors.New("storage config not found")
// 	}
// 
// 	s.logger.Info("Storage config deleted", zap.String("config_id", configID))
// 	return nil
// }
// 
// func (s *StorageService) PutObject(
// 	ctx context.Context,
// 	namespaceID string,
// 	key string,
// 	reader io.Reader,
// 	size int64,
// 	contentType string,
// 	metadata map[string]string,
// ) (*model.Object, error) {
// 	var ns model.Namespace
// 	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
// 		return nil, fmt.Errorf("namespace not found: %w", err)
// 	}
// 
// 	provider, err := s.getProviderForNamespace(ctx, &ns)
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	storageKey := s.buildStorageKey(&ns, key)
// 	opts := []storage.Option{storage.WithContentType(contentType)}
// 	if metadata != nil {
// 		opts = append(opts, storage.WithMetadata(metadata))
// 	}
// 
// 	objInfo, err := provider.Put(ctx, storageKey, reader, size, opts...)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to put object: %w", err)
// 	}
// 
// 	object := &model.Object{
// 		NamespaceID:  namespaceID,
// 		Key:          key,
// 		Name:         filepath.Base(key),
// 		Size:         size,
// 		ContentType:  contentType,
// 		ETag:         objInfo.ETag,
// 		StorageKey:   storageKey,
// 		LastModified: time.Now(),
// 		Metadata:     marshalMetadata(metadata),
// 		IsLatest:     true,
// 	}
// 
// 	if err := s.db.WithContext(ctx).Create(object).Error; err != nil {
// 		_ = provider.Delete(ctx, storageKey)
// 		return nil, fmt.Errorf("failed to save object metadata: %w", err)
// 	}
// 
// 	_ = s.db.WithContext(ctx).Model(&ns).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error
// 	_ = s.db.WithContext(ctx).Model(&ns).Update("used_files", gorm.Expr("used_files + ?", 1)).Error
// 
// 	s.logger.Info("Object uploaded",
// 		zap.String("object_id", object.ID),
// 		zap.String("namespace_id", namespaceID),
// 		zap.String("key", key),
// 		zap.Int64("size", size),
// 	)
// 	return object, nil
// }
// 
// func (s *StorageService) GetObject(ctx context.Context, namespaceID, key string) (io.ReadCloser, *model.Object, error) {
// 	var object model.Object
// 	if err := s.db.WithContext(ctx).
// 		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, nil, errors.New("object not found")
// 		}
// 		return nil, nil, fmt.Errorf("failed to get object metadata: %w", err)
// 	}
// 
// 	var ns model.Namespace
// 	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
// 		return nil, nil, fmt.Errorf("namespace not found: %w", err)
// 	}
// 
// 	provider, err := s.getProviderForNamespace(ctx, &ns)
// 	if err != nil {
// 		return nil, nil, err
// 	}
// 
// 	reader, _, err := provider.Get(ctx, object.StorageKey)
// 	if err != nil {
// 		return nil, nil, fmt.Errorf("failed to get object from storage: %w", err)
// 	}
// 
// 	return reader, &object, nil
// }
// 
// func (s *StorageService) DeleteObject(ctx context.Context, namespaceID, key string) error {
// 	var object model.Object
// 	if err := s.db.WithContext(ctx).
// 		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil
// 		}
// 		return fmt.Errorf("failed to get object metadata: %w", err)
// 	}
// 
// 	var ns model.Namespace
// 	if err := s.db.WithContext(ctx).First(&ns, "id = ?", namespaceID).Error; err != nil {
// 		return fmt.Errorf("namespace not found: %w", err)
// 	}
// 
// 	provider, err := s.getProviderForNamespace(ctx, &ns)
// 	if err != nil {
// 		return err
// 	}
// 	if err := provider.Delete(ctx, object.StorageKey); err != nil {
// 		s.logger.Error("failed to delete object from storage", zap.Error(err))
// 	}
// 
// 	if err := s.db.WithContext(ctx).Delete(&object).Error; err != nil {
// 		return fmt.Errorf("failed to delete object metadata: %w", err)
// 	}
// 
// 	_ = s.db.WithContext(ctx).Model(&ns).Update("used_storage", gorm.Expr("used_storage - ?", object.Size)).Error
// 	_ = s.db.WithContext(ctx).Model(&ns).Update("used_files", gorm.Expr("used_files - ?", 1)).Error
// 
// 	s.logger.Info("Object deleted", zap.String("namespace_id", namespaceID), zap.String("key", key))
// 	return nil
// }
// 
// func (s *StorageService) ListObjects(ctx context.Context, namespaceID, prefix string, page, pageSize int) ([]*model.Object, int64, error) {
// 	if page <= 0 {
// 		page = 1
// 	}
// 	if pageSize <= 0 || pageSize > 100 {
// 		pageSize = 20
// 	}
// 
// 	var objects []*model.Object
// 	var total int64
// 
// 	query := s.db.WithContext(ctx).Model(&model.Object{}).
// 		Where("namespace_id = ? AND is_latest = ?", namespaceID, true)
// 	if prefix != "" {
// 		query = query.Where("key LIKE ?", prefix+"%")
// 	}
// 
// 	if err := query.Count(&total).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to count objects: %w", err)
// 	}
// 
// 	offset := (page - 1) * pageSize
// 	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&objects).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to list objects: %w", err)
// 	}
// 
// 	return objects, total, nil
// }
// 
// func (s *StorageService) PresignGetObject(ctx context.Context, namespaceID, key string, ttl time.Duration) (string, error) {
// 	var object model.Object
// 	if err := s.db.WithContext(ctx).
// 		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return "", errors.New("object not found")
// 		}
// 		return "", fmt.Errorf("failed to get object metadata: %w", err)
// 	}
// 
// 	var ns model.Namespace
// 	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
// 		return "", fmt.Errorf("namespace not found: %w", err)
// 	}
// 
// 	provider, err := s.getProviderForNamespace(ctx, &ns)
// 	if err != nil {
// 		return "", err
// 	}
// 
// 	url, err := provider.PresignGet(ctx, object.StorageKey, ttl)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to presign url: %w", err)
// 	}
// 	return url, nil
// }
// 
// func (s *StorageService) getProviderForNamespace(ctx context.Context, ns *model.Namespace) (storage.StorageProvider, error) {
// 	var cfg *model.StorageConfig
// 
// 	if ns.StorageConfigID != "" {
// 		found, err := s.GetStorageConfig(ctx, ns.StorageConfigID)
// 		if err != nil {
// 			return nil, fmt.Errorf("failed to get storage config: %w", err)
// 		}
// 		cfg = found
// 	} else {
// 		var defaultConfig model.StorageConfig
// 		if err := s.db.WithContext(ctx).First(&defaultConfig, "tenant_id = ? AND is_default = ?", ns.TenantID, true).Error; err != nil {
// 			return nil, fmt.Errorf("no default storage config found: %w", err)
// 		}
// 		cfg = &defaultConfig
// 	}
// 
// 	provider, exists := s.registry.Get(cfg.ID)
// 	if !exists {
// 		factory := storage.NewProviderFactory(s.registry)
// 		if err := factory.CreateAndRegister(ctx, cfg); err != nil {
// 			return nil, fmt.Errorf("failed to create storage provider: %w", err)
// 		}
// 		provider, _ = s.registry.Get(cfg.ID)
// 	}
// 	return provider, nil
// }
// 
// func (s *StorageService) buildStorageKey(ns *model.Namespace, key string) string {
// 	key = strings.TrimPrefix(key, "/")
// 	if ns.PathPrefix != "" {
// 		prefix := strings.TrimSuffix(ns.PathPrefix, "/")
// 		key = prefix + "/" + key
// 	}
// 	return fmt.Sprintf("%s/%s/%s", ns.TenantID, ns.ID, key)
// }
// 
// func marshalMetadata(metadata map[string]string) string {
// 	if len(metadata) == 0 {
// 		return ""
// 	}
// 	b, err := json.Marshal(metadata)
// 	if err != nil {
// 		return ""
// 	}
// 	return string(b)
// }
// 
// type CreateStorageConfigRequest struct {
// 	Name        string `json:"name" binding:"required"`
// 	Provider    string `json:"provider" binding:"required"`
// 	Endpoint    string `json:"endpoint"`
// 	Region      string `json:"region"`
// 	Bucket      string `json:"bucket" binding:"required"`
// 	AccessKey   string `json:"access_key"`
// 	SecretKey   string `json:"secret_key"`
// 	PathStyle   bool   `json:"path_style"`
// 	IsDefault   bool   `json:"is_default"`
// 	ExtraConfig string `json:"extra_config"`
// }
// 
// type PutObjectRequest struct {
// 	NamespaceID string            `json:"namespace_id" binding:"required"`
// 	Key         string            `json:"key" binding:"required"`
// 	ContentType string            `json:"content_type"`
// 	Metadata    map[string]string `json:"metadata"`
// }
// 
// type ListObjectRequest struct {
// 	NamespaceID string `form:"namespace_id" binding:"required"`
// 	Prefix      string `form:"prefix"`
// 	Page        int    `form:"page"`
// 	PageSize    int    `form:"page_size"`
// }

// -----------------------------------------------------------------------------
// FILE: internal/service/tenant_service.go
// -----------------------------------------------------------------------------
// package service
// 
// import (
// 	"context"
// 	"errors"
// 	"fmt"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"go.uber.org/zap"
// 	"gorm.io/gorm"
// )
// 
// // TenantService handles tenant CRUD and quota checks.
// type TenantService struct {
// 	db     *gorm.DB
// 	logger *zap.Logger
// }
// 
// func NewTenantService(db *gorm.DB, logger *zap.Logger) *TenantService {
// 	return &TenantService{db: db, logger: logger}
// }
// 
// func (s *TenantService) CreateTenant(ctx context.Context, req *CreateTenantRequest) (*model.Tenant, error) {
// 	req = s.applyCreateDefaults(req)
// 
// 	var count int64
// 	if err := s.db.WithContext(ctx).Model(&model.Tenant{}).Where("code = ?", req.Code).Count(&count).Error; err != nil {
// 		return nil, fmt.Errorf("failed to check tenant code: %w", err)
// 	}
// 	if count > 0 {
// 		return nil, errors.New("tenant code already exists")
// 	}
// 
// 	tenant := &model.Tenant{
// 		Name:          req.Name,
// 		Code:          req.Code,
// 		Description:   req.Description,
// 		Status:        model.TenantStatusActive,
// 		Plan:          model.TenantPlan(req.Plan),
// 		MaxStorage:    req.MaxStorage,
// 		MaxNamespaces: req.MaxNamespaces,
// 		MaxUsers:      req.MaxUsers,
// 		MaxAPICalls:   req.MaxAPICalls,
// 	}
// 
// 	if err := s.db.WithContext(ctx).Create(tenant).Error; err != nil {
// 		return nil, fmt.Errorf("failed to create tenant: %w", err)
// 	}
// 
// 	defaultNS := &model.Namespace{
// 		TenantID:    tenant.ID,
// 		Name:        "default",
// 		Description: "Default namespace",
// 		Status:      model.NSStatusActive,
// 		IsDefault:   true,
// 	}
// 	if err := s.db.WithContext(ctx).Create(defaultNS).Error; err != nil {
// 		s.logger.Error("failed to create default namespace", zap.Error(err))
// 	}
// 
// 	adminRole := &model.Role{
// 		TenantID:    &tenant.ID,
// 		Code:        "tenant_admin",
// 		Name:        "Tenant Admin",
// 		Description: "Full control over tenant resources",
// 		IsSystem:    false,
// 		Level:       100,
// 	}
// 	if err := s.db.WithContext(ctx).Create(adminRole).Error; err != nil {
// 		s.logger.Error("failed to create admin role", zap.Error(err))
// 	}
// 	if err := s.bindDefaultPermissions(ctx, adminRole); err != nil {
// 		s.logger.Error("failed to bind default permissions", zap.Error(err))
// 	}
// 
// 	s.logger.Info("Tenant created", zap.String("tenant_id", tenant.ID), zap.String("code", tenant.Code))
// 	return tenant, nil
// }
// 
// func (s *TenantService) GetTenant(ctx context.Context, tenantID string) (*model.Tenant, error) {
// 	var tenant model.Tenant
// 	if err := s.db.WithContext(ctx).First(&tenant, "id = ?", tenantID).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("tenant not found")
// 		}
// 		return nil, fmt.Errorf("failed to get tenant: %w", err)
// 	}
// 	return &tenant, nil
// }
// 
// func (s *TenantService) GetTenantByCode(ctx context.Context, code string) (*model.Tenant, error) {
// 	var tenant model.Tenant
// 	if err := s.db.WithContext(ctx).First(&tenant, "code = ?", code).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("tenant not found")
// 		}
// 		return nil, fmt.Errorf("failed to get tenant: %w", err)
// 	}
// 	return &tenant, nil
// }
// 
// func (s *TenantService) ListTenants(ctx context.Context, req *ListTenantRequest) ([]*model.Tenant, int64, error) {
// 	if req == nil {
// 		req = &ListTenantRequest{}
// 	}
// 	if req.Page <= 0 {
// 		req.Page = 1
// 	}
// 	if req.PageSize <= 0 || req.PageSize > 100 {
// 		req.PageSize = 20
// 	}
// 
// 	var tenants []*model.Tenant
// 	var total int64
// 	query := s.db.WithContext(ctx).Model(&model.Tenant{})
// 
// 	if req.Status != "" {
// 		query = query.Where("status = ?", req.Status)
// 	}
// 	if req.Keyword != "" {
// 		like := "%" + req.Keyword + "%"
// 		query = query.Where("name LIKE ? OR code LIKE ?", like, like)
// 	}
// 
// 	if err := query.Count(&total).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to count tenants: %w", err)
// 	}
// 
// 	offset := (req.Page - 1) * req.PageSize
// 	if err := query.Offset(offset).Limit(req.PageSize).Find(&tenants).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to list tenants: %w", err)
// 	}
// 
// 	return tenants, total, nil
// }
// 
// func (s *TenantService) UpdateTenant(ctx context.Context, tenantID string, req *UpdateTenantRequest) (*model.Tenant, error) {
// 	tenant, err := s.GetTenant(ctx, tenantID)
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	updates := map[string]interface{}{}
// 	if req.Name != "" {
// 		updates["name"] = req.Name
// 	}
// 	if req.Description != "" {
// 		updates["description"] = req.Description
// 	}
// 	if req.Status != "" {
// 		updates["status"] = req.Status
// 	}
// 	if req.Plan != "" {
// 		updates["plan"] = req.Plan
// 	}
// 	if req.MaxStorage > 0 {
// 		updates["max_storage"] = req.MaxStorage
// 	}
// 	if req.MaxNamespaces > 0 {
// 		updates["max_namespaces"] = req.MaxNamespaces
// 	}
// 	if req.MaxUsers > 0 {
// 		updates["max_users"] = req.MaxUsers
// 	}
// 	if req.MaxAPICalls > 0 {
// 		updates["max_api_calls"] = req.MaxAPICalls
// 	}
// 
// 	if len(updates) > 0 {
// 		if err := s.db.WithContext(ctx).Model(tenant).Updates(updates).Error; err != nil {
// 			return nil, fmt.Errorf("failed to update tenant: %w", err)
// 		}
// 	}
// 
// 	return s.GetTenant(ctx, tenantID)
// }
// 
// func (s *TenantService) DeleteTenant(ctx context.Context, tenantID string) error {
// 	result := s.db.WithContext(ctx).Delete(&model.Tenant{}, "id = ?", tenantID)
// 	if result.Error != nil {
// 		return fmt.Errorf("failed to delete tenant: %w", result.Error)
// 	}
// 	if result.RowsAffected == 0 {
// 		return errors.New("tenant not found")
// 	}
// 
// 	s.logger.Info("Tenant deleted", zap.String("tenant_id", tenantID))
// 	return nil
// }
// 
// func (s *TenantService) CheckQuota(ctx context.Context, tenantID string, quotaType QuotaType) error {
// 	tenant, err := s.GetTenant(ctx, tenantID)
// 	if err != nil {
// 		return err
// 	}
// 
// 	switch quotaType {
// 	case QuotaTypeStorage:
// 		if tenant.UsedStorage >= tenant.MaxStorage {
// 			return errors.New("storage quota exceeded")
// 		}
// 	case QuotaTypeNamespace:
// 		if tenant.UsedNamespaces >= tenant.MaxNamespaces {
// 			return errors.New("namespace quota exceeded")
// 		}
// 	case QuotaTypeUser:
// 		if tenant.UsedUsers >= tenant.MaxUsers {
// 			return errors.New("user quota exceeded")
// 		}
// 	case QuotaTypeAPICalls:
// 		if tenant.UsedAPICalls >= tenant.MaxAPICalls {
// 			return errors.New("api calls quota exceeded")
// 		}
// 	}
// 
// 	return nil
// }
// 
// func (s *TenantService) applyCreateDefaults(req *CreateTenantRequest) *CreateTenantRequest {
// 	if req == nil {
// 		req = &CreateTenantRequest{}
// 	}
// 	if req.Plan == "" {
// 		req.Plan = string(model.TenantPlanFree)
// 	}
// 	if req.MaxStorage <= 0 {
// 		req.MaxStorage = 10 * 1024 * 1024 * 1024
// 	}
// 	if req.MaxNamespaces <= 0 {
// 		req.MaxNamespaces = 10
// 	}
// 	if req.MaxUsers <= 0 {
// 		req.MaxUsers = 100
// 	}
// 	if req.MaxAPICalls <= 0 {
// 		req.MaxAPICalls = 100000
// 	}
// 	return req
// }
// 
// func (s *TenantService) bindDefaultPermissions(ctx context.Context, role *model.Role) error {
// 	resourceActions := map[string][]model.PermissionAction{
// 		"tenant":    {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionAdmin},
// 		"user":      {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
// 		"namespace": {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
// 		"storage":   {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
// 		"object":    {model.ActionCreate, model.ActionRead, model.ActionDelete, model.ActionList, model.ActionShare},
// 	}
// 
// 	var permissions []model.Permission
// 	for resource, actions := range resourceActions {
// 		for _, action := range actions {
// 			code := fmt.Sprintf("%s:%s", resource, action)
// 			p := model.Permission{
// 				Code:        code,
// 				Name:        code,
// 				Description: "Auto generated default permission",
// 				Resource:    resource,
// 				Action:      action,
// 			}
// 			if err := s.db.WithContext(ctx).Where("code = ?", code).FirstOrCreate(&p).Error; err != nil {
// 				return err
// 			}
// 			permissions = append(permissions, p)
// 		}
// 	}
// 
// 	return s.db.WithContext(ctx).Model(role).Association("Permissions").Replace(permissions)
// }
// 
// type CreateTenantRequest struct {
// 	Name          string `json:"name" binding:"required"`
// 	Code          string `json:"code" binding:"required"`
// 	Description   string `json:"description"`
// 	Plan          string `json:"plan"`
// 	MaxStorage    int64  `json:"max_storage"`
// 	MaxNamespaces int    `json:"max_namespaces"`
// 	MaxUsers      int    `json:"max_users"`
// 	MaxAPICalls   int64  `json:"max_api_calls"`
// }
// 
// type UpdateTenantRequest struct {
// 	Name          string `json:"name"`
// 	Description   string `json:"description"`
// 	Status        string `json:"status"`
// 	Plan          string `json:"plan"`
// 	MaxStorage    int64  `json:"max_storage"`
// 	MaxNamespaces int    `json:"max_namespaces"`
// 	MaxUsers      int    `json:"max_users"`
// 	MaxAPICalls   int64  `json:"max_api_calls"`
// }
// 
// type ListTenantRequest struct {
// 	Page     int    `form:"page"`
// 	PageSize int    `form:"page_size"`
// 	Status   string `form:"status"`
// 	Keyword  string `form:"keyword"`
// }
// 
// type QuotaType string
// 
// const (
// 	QuotaTypeStorage   QuotaType = "storage"
// 	QuotaTypeNamespace QuotaType = "namespace"
// 	QuotaTypeUser      QuotaType = "user"
// 	QuotaTypeAPICalls  QuotaType = "api_calls"
// )

// -----------------------------------------------------------------------------
// FILE: internal/service/user_service.go
// -----------------------------------------------------------------------------
// package service
// 
// import (
// 	"context"
// 	"errors"
// 	"fmt"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"github.com/golang-jwt/jwt/v5"
// 	"go.uber.org/zap"
// 	"gorm.io/gorm"
// )
// 
// // UserService handles user and login flow.
// type UserService struct {
// 	db        *gorm.DB
// 	logger    *zap.Logger
// 	jwtSecret string
// }
// 
// func NewUserService(db *gorm.DB, logger *zap.Logger, jwtSecret string) *UserService {
// 	return &UserService{db: db, logger: logger, jwtSecret: jwtSecret}
// }
// 
// func (s *UserService) CreateUser(ctx context.Context, tenantID string, req *CreateUserRequest) (*model.User, error) {
// 	var count int64
// 	if err := s.db.WithContext(ctx).Model(&model.User{}).
// 		Where("tenant_id = ? AND username = ?", tenantID, req.Username).
// 		Count(&count).Error; err != nil {
// 		return nil, fmt.Errorf("failed to check username: %w", err)
// 	}
// 	if count > 0 {
// 		return nil, errors.New("username already exists")
// 	}
// 
// 	if err := s.db.WithContext(ctx).Model(&model.User{}).
// 		Where("tenant_id = ? AND email = ?", tenantID, req.Email).
// 		Count(&count).Error; err != nil {
// 		return nil, fmt.Errorf("failed to check email: %w", err)
// 	}
// 	if count > 0 {
// 		return nil, errors.New("email already exists")
// 	}
// 
// 	user := &model.User{
// 		TenantID: tenantID,
// 		Username: req.Username,
// 		Email:    req.Email,
// 		Nickname: req.Nickname,
// 		Status:   model.UserStatusActive,
// 	}
// 
// 	if err := user.SetPassword(req.Password); err != nil {
// 		return nil, fmt.Errorf("failed to hash password: %w", err)
// 	}
// 
// 	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
// 		return nil, fmt.Errorf("failed to create user: %w", err)
// 	}
// 
// 	if len(req.RoleIDs) > 0 {
// 		if err := s.assignRoles(ctx, user, req.RoleIDs); err != nil {
// 			return nil, err
// 		}
// 	}
// 
// 	s.logger.Info("User created",
// 		zap.String("user_id", user.ID),
// 		zap.String("tenant_id", tenantID),
// 		zap.String("username", user.Username),
// 	)
// 	return user, nil
// }
// 
// func (s *UserService) GetUser(ctx context.Context, userID string) (*model.User, error) {
// 	var user model.User
// 	if err := s.db.WithContext(ctx).Preload("Roles.Permissions").First(&user, "id = ?", userID).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("user not found")
// 		}
// 		return nil, fmt.Errorf("failed to get user: %w", err)
// 	}
// 	return &user, nil
// }
// 
// func (s *UserService) GetUserByUsername(ctx context.Context, tenantID, username string) (*model.User, error) {
// 	var user model.User
// 	if err := s.db.WithContext(ctx).Preload("Roles.Permissions").
// 		First(&user, "tenant_id = ? AND username = ?", tenantID, username).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("user not found")
// 		}
// 		return nil, fmt.Errorf("failed to get user: %w", err)
// 	}
// 	return &user, nil
// }
// 
// func (s *UserService) ListUsers(ctx context.Context, tenantID string, req *ListUserRequest) ([]*model.User, int64, error) {
// 	if req == nil {
// 		req = &ListUserRequest{}
// 	}
// 	if req.Page <= 0 {
// 		req.Page = 1
// 	}
// 	if req.PageSize <= 0 || req.PageSize > 100 {
// 		req.PageSize = 20
// 	}
// 
// 	var users []*model.User
// 	var total int64
// 
// 	query := s.db.WithContext(ctx).Model(&model.User{}).Where("tenant_id = ?", tenantID)
// 	if req.Status != "" {
// 		query = query.Where("status = ?", req.Status)
// 	}
// 	if req.Keyword != "" {
// 		like := "%" + req.Keyword + "%"
// 		query = query.Where("username LIKE ? OR email LIKE ? OR nickname LIKE ?", like, like, like)
// 	}
// 
// 	if err := query.Count(&total).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to count users: %w", err)
// 	}
// 
// 	offset := (req.Page - 1) * req.PageSize
// 	if err := query.Preload("Roles").Offset(offset).Limit(req.PageSize).Find(&users).Error; err != nil {
// 		return nil, 0, fmt.Errorf("failed to list users: %w", err)
// 	}
// 
// 	return users, total, nil
// }
// 
// func (s *UserService) UpdateUser(ctx context.Context, userID string, req *UpdateUserRequest) (*model.User, error) {
// 	user, err := s.GetUser(ctx, userID)
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	updates := map[string]interface{}{}
// 	if req.Nickname != "" {
// 		updates["nickname"] = req.Nickname
// 	}
// 	if req.Avatar != "" {
// 		updates["avatar"] = req.Avatar
// 	}
// 	if req.Status != "" {
// 		updates["status"] = req.Status
// 	}
// 
// 	if len(updates) > 0 {
// 		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
// 			return nil, fmt.Errorf("failed to update user: %w", err)
// 		}
// 	}
// 
// 	if len(req.RoleIDs) > 0 {
// 		if err := s.assignRoles(ctx, user, req.RoleIDs); err != nil {
// 			return nil, err
// 		}
// 	}
// 
// 	return s.GetUser(ctx, userID)
// }
// 
// func (s *UserService) DeleteUser(ctx context.Context, userID string) error {
// 	result := s.db.WithContext(ctx).Delete(&model.User{}, "id = ?", userID)
// 	if result.Error != nil {
// 		return fmt.Errorf("failed to delete user: %w", result.Error)
// 	}
// 	if result.RowsAffected == 0 {
// 		return errors.New("user not found")
// 	}
// 
// 	s.logger.Info("User deleted", zap.String("user_id", userID))
// 	return nil
// }
// 
// func (s *UserService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
// 	user, err := s.GetUser(ctx, userID)
// 	if err != nil {
// 		return err
// 	}
// 	if !user.CheckPassword(oldPassword) {
// 		return errors.New("invalid old password")
// 	}
// 	if err := user.SetPassword(newPassword); err != nil {
// 		return fmt.Errorf("failed to hash password: %w", err)
// 	}
// 	if err := s.db.WithContext(ctx).Model(user).Update("password", user.Password).Error; err != nil {
// 		return fmt.Errorf("failed to update password: %w", err)
// 	}
// 
// 	s.logger.Info("Password changed", zap.String("user_id", userID))
// 	return nil
// }
// 
// func (s *UserService) Login(ctx context.Context, tenantCode, username, password string) (*LoginResponse, error) {
// 	var tenant model.Tenant
// 	if err := s.db.WithContext(ctx).First(&tenant, "code = ?", tenantCode).Error; err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return nil, errors.New("tenant not found")
// 		}
// 		return nil, fmt.Errorf("failed to get tenant: %w", err)
// 	}
// 	if tenant.Status != model.TenantStatusActive {
// 		return nil, errors.New("tenant is not active")
// 	}
// 
// 	user, err := s.GetUserByUsername(ctx, tenant.ID, username)
// 	if err != nil || !user.CheckPassword(password) {
// 		return nil, errors.New("invalid username or password")
// 	}
// 	if user.Status != model.UserStatusActive {
// 		return nil, errors.New("user is not active")
// 	}
// 
// 	token, err := s.generateToken(user)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to generate token: %w", err)
// 	}
// 
// 	now := time.Now()
// 	_ = s.db.WithContext(ctx).Model(user).Update("last_login_at", now).Error
// 
// 	s.logger.Info("User logged in",
// 		zap.String("user_id", user.ID),
// 		zap.String("tenant_id", user.TenantID),
// 		zap.String("username", user.Username),
// 	)
// 
// 	return &LoginResponse{
// 		Token:     token,
// 		ExpiresAt: now.Add(24 * time.Hour),
// 		User:      user,
// 		Tenant:    &tenant,
// 	}, nil
// }
// 
// func (s *UserService) generateToken(user *model.User) (string, error) {
// 	now := time.Now()
// 	claims := jwt.MapClaims{
// 		"user_id":   user.ID,
// 		"tenant_id": user.TenantID,
// 		"username":  user.Username,
// 		"exp":       now.Add(24 * time.Hour).Unix(),
// 		"iat":       now.Unix(),
// 	}
// 	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtSecret))
// }
// 
// func (s *UserService) ValidateToken(tokenString string) (*jwt.MapClaims, error) {
// 	token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
// 		if token.Method != jwt.SigningMethodHS256 {
// 			return nil, errors.New("unexpected signing method")
// 		}
// 		return []byte(s.jwtSecret), nil
// 	})
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	claims, ok := token.Claims.(*jwt.MapClaims)
// 	if !ok || !token.Valid {
// 		return nil, errors.New("invalid token")
// 	}
// 	return claims, nil
// }
// 
// func (s *UserService) assignRoles(ctx context.Context, user *model.User, roleIDs []string) error {
// 	var roles []model.Role
// 	if err := s.db.WithContext(ctx).Find(&roles, "id IN ?", roleIDs).Error; err != nil {
// 		return fmt.Errorf("failed to find roles: %w", err)
// 	}
// 	if err := s.db.WithContext(ctx).Model(user).Association("Roles").Replace(roles); err != nil {
// 		return fmt.Errorf("failed to assign roles: %w", err)
// 	}
// 	return nil
// }
// 
// type CreateUserRequest struct {
// 	Username string   `json:"username" binding:"required"`
// 	Email    string   `json:"email" binding:"required,email"`
// 	Password string   `json:"password" binding:"required,min=6"`
// 	Nickname string   `json:"nickname"`
// 	RoleIDs  []string `json:"role_ids"`
// }
// 
// type UpdateUserRequest struct {
// 	Nickname string   `json:"nickname"`
// 	Avatar   string   `json:"avatar"`
// 	Status   string   `json:"status"`
// 	RoleIDs  []string `json:"role_ids"`
// }
// 
// type ListUserRequest struct {
// 	Page     int    `form:"page"`
// 	PageSize int    `form:"page_size"`
// 	Status   string `form:"status"`
// 	Keyword  string `form:"keyword"`
// }
// 
// type LoginRequest struct {
// 	TenantCode string `json:"tenant_code" binding:"required"`
// 	Username   string `json:"username" binding:"required"`
// 	Password   string `json:"password" binding:"required"`
// }
// 
// type LoginResponse struct {
// 	Token     string        `json:"token"`
// 	ExpiresAt time.Time     `json:"expires_at"`
// 	User      *model.User   `json:"user"`
// 	Tenant    *model.Tenant `json:"tenant"`
// }
// 
// type ChangePasswordRequest struct {
// 	OldPassword string `json:"old_password" binding:"required"`
// 	NewPassword string `json:"new_password" binding:"required,min=6"`
// }

// -----------------------------------------------------------------------------
// FILE: internal/storage/local_provider.go
// -----------------------------------------------------------------------------
// package storage
// 
// import (
// 	"context"
// 	"crypto/md5"
// 	"encoding/hex"
// 	"encoding/json"
// 	"fmt"
// 	"io"
// 	"os"
// 	"path/filepath"
// 	"strings"
// 	"time"
// )
// 
// // LocalProvider 鏈湴鏂囦欢绯荤粺瀛樺偍鎻愪緵鑰?// 鐢ㄤ簬寮€鍙戞祴璇曟垨灏忚妯￠儴缃?type LocalProvider struct {
// 	baseDir string
// 	metaDir string // 鍏冩暟鎹洰褰?}
// 
// // NewLocalProvider 鍒涘缓鏈湴瀛樺偍鎻愪緵鑰?func NewLocalProvider(baseDir string) (*LocalProvider, error) {
// 	// 纭繚鐩綍瀛樺湪
// 	if err := os.MkdirAll(baseDir, 0755); err != nil {
// 		return nil, fmt.Errorf("failed to create base directory: %w", err)
// 	}
// 
// 	metaDir := filepath.Join(baseDir, ".meta")
// 	if err := os.MkdirAll(metaDir, 0755); err != nil {
// 		return nil, fmt.Errorf("failed to create meta directory: %w", err)
// 	}
// 
// 	return &LocalProvider{
// 		baseDir: baseDir,
// 		metaDir: metaDir,
// 	}, nil
// }
// 
// // Put 涓婁紶瀵硅薄
// func (p *LocalProvider) Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error) {
// 	options := &Options{}
// 	for _, opt := range opts {
// 		opt(options)
// 	}
// 
// 	// 瀹夊叏妫€鏌ワ細闃叉璺緞绌胯秺
// 	if strings.Contains(key, "..") {
// 		return nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
// 	}
// 
// 	// 鏋勫缓瀹屾暣璺緞
// 	fullPath := filepath.Join(p.baseDir, key)
// 	dir := filepath.Dir(fullPath)
// 
// 	// 纭繚鐩綍瀛樺湪
// 	if err := os.MkdirAll(dir, 0755); err != nil {
// 		return nil, NewInternalError("failed to create directory", err)
// 	}
// 
// 	// 鍒涘缓涓存椂鏂囦欢
// 	tmpFile := fullPath + ".tmp"
// 	f, err := os.Create(tmpFile)
// 	if err != nil {
// 		return nil, NewInternalError("failed to create file", err)
// 	}
// 	defer f.Close()
// 
// 	// 鍐欏叆鍐呭骞惰绠?MD5
// 	hash := md5.New()
// 	multiWriter := io.MultiWriter(f, hash)
// 	written, err := io.Copy(multiWriter, reader)
// 	if err != nil {
// 		os.Remove(tmpFile)
// 		return nil, NewInternalError("failed to write file", err)
// 	}
// 
// 	// 閲嶅懡鍚嶄复鏃舵枃浠?	if err := os.Rename(tmpFile, fullPath); err != nil {
// 		os.Remove(tmpFile)
// 		return nil, NewInternalError("failed to rename file", err)
// 	}
// 
// 	// 璁＄畻ETag
// 	etag := hex.EncodeToString(hash.Sum(nil))
// 
// 	// 淇濆瓨鍏冩暟鎹?	contentType := options.ContentType
// 	if contentType == "" {
// 		contentType = "application/octet-stream"
// 	}
// 
// 	meta := &objectMeta{
// 		ContentType:  contentType,
// 		ETag:         etag,
// 		LastModified: time.Now(),
// 		Size:         written,
// 		Metadata:     options.Metadata,
// 	}
// 
// 	if err := p.saveMeta(key, meta); err != nil {
// 		return nil, err
// 	}
// 
// 	return &ObjectInfo{
// 		Key:          key,
// 		Size:         written,
// 		ContentType:  contentType,
// 		ETag:         etag,
// 		LastModified: meta.LastModified,
// 		Metadata:     options.Metadata,
// 	}, nil
// }
// 
// // Get 鑾峰彇瀵硅薄
// func (p *LocalProvider) Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error) {
// 	if strings.Contains(key, "..") {
// 		return nil, nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
// 	}
// 
// 	fullPath := filepath.Join(p.baseDir, key)
// 
// 	f, err := os.Open(fullPath)
// 	if err != nil {
// 		if os.IsNotExist(err) {
// 			return nil, nil, NewNotFoundError(key, err)
// 		}
// 		return nil, nil, NewInternalError("failed to open file", err)
// 	}
// 
// 	info, err := p.Stat(ctx, key)
// 	if err != nil {
// 		f.Close()
// 		return nil, nil, err
// 	}
// 
// 	return f, info, nil
// }
// 
// // Delete 鍒犻櫎瀵硅薄
// func (p *LocalProvider) Delete(ctx context.Context, key string) error {
// 	if strings.Contains(key, "..") {
// 		return NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
// 	}
// 
// 	fullPath := filepath.Join(p.baseDir, key)
// 
// 	if err := os.Remove(fullPath); err != nil {
// 		if os.IsNotExist(err) {
// 			return nil // 宸插垹闄?		}
// 		return NewInternalError("failed to delete file", err)
// 	}
// 
// 	// 鍒犻櫎鍏冩暟鎹?	metaPath := p.metaPath(key)
// 	os.Remove(metaPath)
// 
// 	return nil
// }
// 
// // Stat 鑾峰彇瀵硅薄淇℃伅
// func (p *LocalProvider) Stat(ctx context.Context, key string) (*ObjectInfo, error) {
// 	if strings.Contains(key, "..") {
// 		return nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
// 	}
// 
// 	meta, err := p.loadMeta(key)
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	fullPath := filepath.Join(p.baseDir, key)
// 	stat, err := os.Stat(fullPath)
// 	if err != nil {
// 		if os.IsNotExist(err) {
// 			return nil, NewNotFoundError(key, err)
// 		}
// 		return nil, NewInternalError("failed to stat file", err)
// 	}
// 
// 	return &ObjectInfo{
// 		Key:          key,
// 		Size:         stat.Size(),
// 		ContentType:  meta.ContentType,
// 		ETag:         meta.ETag,
// 		LastModified: stat.ModTime(),
// 		Metadata:     meta.Metadata,
// 	}, nil
// }
// 
// // List 鍒楀嚭瀵硅薄
// func (p *LocalProvider) List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error) {
// 	options := &ListOptions{
// 		MaxKeys:   1000,
// 		Recursive: true,
// 	}
// 	for _, opt := range opts {
// 		opt(options)
// 	}
// 
// 	var objects []*ObjectInfo
// 
// 	searchDir := p.baseDir
// 	if prefix != "" {
// 		searchDir = filepath.Join(p.baseDir, prefix)
// 	}
// 
// 	err := filepath.Walk(searchDir, func(path string, info os.FileInfo, err error) error {
// 		if err != nil {
// 			return err
// 		}
// 
// 		// 璺宠繃鐩綍鍜屽厓鏁版嵁鐩綍
// 		if info.IsDir() || strings.Contains(path, ".meta") {
// 			return nil
// 		}
// 
// 		// 璁＄畻鐩稿璺緞
// 		relPath, err := filepath.Rel(p.baseDir, path)
// 		if err != nil {
// 			return err
// 		}
// 
// 		// 杞崲涓?Unix 椋庢牸璺緞
// 		relPath = filepath.ToSlash(relPath)
// 
// 		objInfo, err := p.Stat(ctx, relPath)
// 		if err != nil {
// 			return nil // 璺宠繃鏃犳硶鑾峰彇淇℃伅鐨勬枃浠?		}
// 
// 		objects = append(objects, objInfo)
// 
// 		if len(objects) >= options.MaxKeys {
// 			return io.EOF
// 		}
// 
// 		return nil
// 	})
// 
// 	if err != nil && err != io.EOF {
// 		return nil, NewInternalError("failed to list files", err)
// 	}
// 
// 	return objects, nil
// }
// 
// // DeleteBatch 鎵归噺鍒犻櫎
// func (p *LocalProvider) DeleteBatch(ctx context.Context, keys []string) error {
// 	for _, key := range keys {
// 		if err := p.Delete(ctx, key); err != nil {
// 			return err
// 		}
// 	}
// 	return nil
// }
// 
// // Copy 鎷疯礉瀵硅薄
// func (p *LocalProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
// 	if strings.Contains(srcKey, "..") || strings.Contains(dstKey, "..") {
// 		return NewAccessDeniedError(srcKey, fmt.Errorf("invalid key: path traversal detected"))
// 	}
// 
// 	srcPath := filepath.Join(p.baseDir, srcKey)
// 	dstPath := filepath.Join(p.baseDir, dstKey)
// 
// 	// 纭繚鐩爣鐩綍瀛樺湪
// 	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
// 		return NewInternalError("failed to create directory", err)
// 	}
// 
// 	// 鎷疯礉鏂囦欢
// 	src, err := os.Open(srcPath)
// 	if err != nil {
// 		return NewInternalError("failed to open source file", err)
// 	}
// 	defer src.Close()
// 
// 	dst, err := os.Create(dstPath)
// 	if err != nil {
// 		return NewInternalError("failed to create destination file", err)
// 	}
// 	defer dst.Close()
// 
// 	if _, err := io.Copy(dst, src); err != nil {
// 		return NewInternalError("failed to copy file", err)
// 	}
// 
// 	// 鎷疯礉鍏冩暟鎹?	srcMeta, err := p.loadMeta(srcKey)
// 	if err != nil {
// 		return err
// 	}
// 	if err := p.saveMeta(dstKey, srcMeta); err != nil {
// 		return err
// 	}
// 
// 	return nil
// }
// 
// // Move 绉诲姩瀵硅薄
// func (p *LocalProvider) Move(ctx context.Context, srcKey, dstKey string) error {
// 	if err := p.Copy(ctx, srcKey, dstKey); err != nil {
// 		return err
// 	}
// 	return p.Delete(ctx, srcKey)
// }
// 
// // PresignPut 鐢熸垚涓婁紶棰勭鍚?URL锛堟湰鍦板瓨鍌ㄤ笉鏀寔锛?func (p *LocalProvider) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
// 	return "", NewInternalError("presign not supported for local storage", nil)
// }
// 
// // PresignGet 鐢熸垚涓嬭浇棰勭鍚?URL锛堟湰鍦板瓨鍌ㄤ笉鏀寔锛?func (p *LocalProvider) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
// 	return "", NewInternalError("presign not supported for local storage", nil)
// }
// 
// // CreateBucket 鍒涘缓瀛樺偍妗讹紙鏈湴瀛樺偍涓嶆敮鎸侊級
// func (p *LocalProvider) CreateBucket(ctx context.Context, bucket string) error {
// 	bucketPath := filepath.Join(p.baseDir, bucket)
// 	return os.MkdirAll(bucketPath, 0755)
// }
// 
// // DeleteBucket 鍒犻櫎瀛樺偍妗?func (p *LocalProvider) DeleteBucket(ctx context.Context, bucket string) error {
// 	bucketPath := filepath.Join(p.baseDir, bucket)
// 	return os.RemoveAll(bucketPath)
// }
// 
// // BucketExists 妫€鏌ュ瓨鍌ㄦ《鏄惁瀛樺湪
// func (p *LocalProvider) BucketExists(ctx context.Context, bucket string) (bool, error) {
// 	bucketPath := filepath.Join(p.baseDir, bucket)
// 	_, err := os.Stat(bucketPath)
// 	if err != nil {
// 		if os.IsNotExist(err) {
// 			return false, nil
// 		}
// 		return false, err
// 	}
// 	return true, nil
// }
// 
// // Type 杩斿洖鎻愪緵鑰呯被鍨?func (p *LocalProvider) Type() ProviderType {
// 	return ProviderTypeLocal
// }
// 
// // Close 鍏抽棴鎻愪緵鑰?func (p *LocalProvider) Close() error {
// 	return nil
// }
// 
// // objectMeta 瀵硅薄鍏冩暟鎹?type objectMeta struct {
// 	ContentType  string            `json:"content_type"`
// 	ETag         string            `json:"etag"`
// 	LastModified time.Time         `json:"last_modified"`
// 	Size         int64             `json:"size"`
// 	Metadata     map[string]string `json:"metadata,omitempty"`
// }
// 
// // metaPath 鑾峰彇鍏冩暟鎹枃浠惰矾寰?func (p *LocalProvider) metaPath(key string) string {
// 	return filepath.Join(p.metaDir, key+".json")
// }
// 
// // saveMeta 淇濆瓨鍏冩暟鎹?func (p *LocalProvider) saveMeta(key string, meta *objectMeta) error {
// 	metaPath := p.metaPath(key)
// 	if err := os.MkdirAll(filepath.Dir(metaPath), 0755); err != nil {
// 		return NewInternalError("failed to create meta directory", err)
// 	}
// 
// 	data, err := json.Marshal(meta)
// 	if err != nil {
// 		return NewInternalError("failed to marshal metadata", err)
// 	}
// 
// 	if err := os.WriteFile(metaPath, data, 0644); err != nil {
// 		return NewInternalError("failed to write metadata", err)
// 	}
// 
// 	return nil
// }
// 
// // loadMeta 鍔犺浇鍏冩暟鎹?func (p *LocalProvider) loadMeta(key string) (*objectMeta, error) {
// 	metaPath := p.metaPath(key)
// 
// 	data, err := os.ReadFile(metaPath)
// 	if err != nil {
// 		if os.IsNotExist(err) {
// 			// 杩斿洖榛樿鍏冩暟鎹?			return &objectMeta{
// 				ContentType:  "application/octet-stream",
// 				LastModified: time.Now(),
// 			}, nil
// 		}
// 		return nil, NewInternalError("failed to read metadata", err)
// 	}
// 
// 	var meta objectMeta
// 	if err := json.Unmarshal(data, &meta); err != nil {
// 		return nil, NewInternalError("failed to unmarshal metadata", err)
// 	}
// 
// 	return &meta, nil
// }

// -----------------------------------------------------------------------------
// FILE: internal/storage/provider.go
// -----------------------------------------------------------------------------
// package storage
// 
// import (
// 	"context"
// 	"io"
// 	"time"
// )
// 
// // StorageProvider 瀛樺偍鎻愪緵鑰呮帴鍙?// 鎵€鏈夊瓨鍌ㄥ悗绔兘蹇呴』瀹炵幇杩欎釜鎺ュ彛
// type StorageProvider interface {
// 	// 鍩虹鎿嶄綔
// 	Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error)
// 	Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error)
// 	Delete(ctx context.Context, key string) error
// 	Stat(ctx context.Context, key string) (*ObjectInfo, error)
// 	List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error)
// 
// 	// 鎵归噺鎿嶄綔
// 	DeleteBatch(ctx context.Context, keys []string) error
// 
// 	// 鎷疯礉鍜岀Щ鍔?	Copy(ctx context.Context, srcKey, dstKey string) error
// 	Move(ctx context.Context, srcKey, dstKey string) error
// 
// 	// 棰勭鍚?URL
// 	PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error)
// 	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
// 
// 	// 瀛樺偍妗舵搷浣?	CreateBucket(ctx context.Context, bucket string) error
// 	DeleteBucket(ctx context.Context, bucket string) error
// 	BucketExists(ctx context.Context, bucket string) (bool, error)
// 
// 	// 绫诲瀷淇℃伅
// 	Type() ProviderType
// 	Close() error
// }
// 
// // ObjectInfo 瀵硅薄鍏冧俊鎭?type ObjectInfo struct {
// 	Key          string            `json:"key"`
// 	Size         int64             `json:"size"`
// 	ContentType  string            `json:"content_type"`
// 	ETag         string            `json:"etag"`
// 	LastModified time.Time         `json:"last_modified"`
// 	Metadata     map[string]string `json:"metadata"`
// }
// 
// // ProviderType 瀛樺偍鎻愪緵鑰呯被鍨?type ProviderType string
// 
// const (
// 	ProviderTypeS3    ProviderType = "s3"
// 	ProviderTypeMinio ProviderType = "minio"
// 	ProviderTypeOSS   ProviderType = "oss"
// 	ProviderTypeCOS   ProviderType = "cos"
// 	ProviderTypeLocal ProviderType = "local"
// 	ProviderTypeGCS   ProviderType = "gcs"
// 	ProviderTypeAzure ProviderType = "azure"
// )
// 
// // Option 涓婁紶閫夐」
// type Option func(*Options)
// 
// type Options struct {
// 	ContentType  string
// 	Metadata     map[string]string
// 	StorageClass string
// }
// 
// func WithContentType(ct string) Option {
// 	return func(o *Options) {
// 		o.ContentType = ct
// 	}
// }
// 
// func WithMetadata(m map[string]string) Option {
// 	return func(o *Options) {
// 		o.Metadata = m
// 	}
// }
// 
// func WithStorageClass(sc string) Option {
// 	return func(o *Options) {
// 		o.StorageClass = sc
// 	}
// }
// 
// // ListOption 鍒楄〃閫夐」
// type ListOption func(*ListOptions)
// 
// type ListOptions struct {
// 	MaxKeys   int
// 	Delimiter string
// 	Marker    string
// 	Recursive bool
// }
// 
// func WithMaxKeys(max int) ListOption {
// 	return func(o *ListOptions) {
// 		o.MaxKeys = max
// 	}
// }
// 
// func WithDelimiter(d string) ListOption {
// 	return func(o *ListOptions) {
// 		o.Delimiter = d
// 	}
// }
// 
// func WithMarker(m string) ListOption {
// 	return func(o *ListOptions) {
// 		o.Marker = m
// 	}
// }
// 
// func WithRecursive(r bool) ListOption {
// 	return func(o *ListOptions) {
// 		o.Recursive = r
// 	}
// }
// 
// // StorageError 瀛樺偍閿欒
// type StorageError struct {
// 	Code    string
// 	Message string
// 	Cause   error
// }
// 
// func (e *StorageError) Error() string {
// 	if e.Cause != nil {
// 		return e.Code + ": " + e.Message + " - " + e.Cause.Error()
// 	}
// 	return e.Code + ": " + e.Message
// }
// 
// func (e *StorageError) Unwrap() error {
// 	return e.Cause
// }
// 
// // 甯歌閿欒鐮?const (
// 	ErrCodeNotFound       = "NotFound"
// 	ErrCodeAlreadyExists  = "AlreadyExists"
// 	ErrCodeAccessDenied   = "AccessDenied"
// 	ErrCodeInvalidRequest = "InvalidRequest"
// 	ErrCodeInternalError  = "InternalError"
// )
// 
// func NewNotFoundError(key string, cause error) *StorageError {
// 	return &StorageError{
// 		Code:    ErrCodeNotFound,
// 		Message: "object not found: " + key,
// 		Cause:   cause,
// 	}
// }
// 
// func NewAlreadyExistsError(key string, cause error) *StorageError {
// 	return &StorageError{
// 		Code:    ErrCodeAlreadyExists,
// 		Message: "object already exists: " + key,
// 		Cause:   cause,
// 	}
// }
// 
// func NewAccessDeniedError(key string, cause error) *StorageError {
// 	return &StorageError{
// 		Code:    ErrCodeAccessDenied,
// 		Message: "access denied: " + key,
// 		Cause:   cause,
// 	}
// }
// 
// func NewInternalError(message string, cause error) *StorageError {
// 	return &StorageError{
// 		Code:    ErrCodeInternalError,
// 		Message: message,
// 		Cause:   cause,
// 	}
// }

// -----------------------------------------------------------------------------
// FILE: internal/storage/registry.go
// -----------------------------------------------------------------------------
// package storage
// 
// import (
// 	"context"
// 	"fmt"
// 	"sync"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// )
// 
// // Registry keeps provider instances keyed by storage config id.
// type Registry struct {
// 	mu        sync.RWMutex
// 	providers map[string]StorageProvider
// 	configs   map[string]*model.StorageConfig
// }
// 
// func NewRegistry() *Registry {
// 	return &Registry{
// 		providers: make(map[string]StorageProvider),
// 		configs:   make(map[string]*model.StorageConfig),
// 	}
// }
// 
// func (r *Registry) Register(id string, provider StorageProvider, cfg *model.StorageConfig) {
// 	r.mu.Lock()
// 	defer r.mu.Unlock()
// 
// 	if old, exists := r.providers[id]; exists {
// 		_ = old.Close()
// 	}
// 
// 	r.providers[id] = provider
// 	r.configs[id] = cfg
// }
// 
// func (r *Registry) Unregister(id string) {
// 	r.mu.Lock()
// 	defer r.mu.Unlock()
// 
// 	if provider, exists := r.providers[id]; exists {
// 		_ = provider.Close()
// 		delete(r.providers, id)
// 	}
// 	delete(r.configs, id)
// }
// 
// func (r *Registry) Get(id string) (StorageProvider, bool) {
// 	r.mu.RLock()
// 	defer r.mu.RUnlock()
// 	provider, exists := r.providers[id]
// 	return provider, exists
// }
// 
// func (r *Registry) GetConfig(id string) (*model.StorageConfig, bool) {
// 	r.mu.RLock()
// 	defer r.mu.RUnlock()
// 	cfg, exists := r.configs[id]
// 	return cfg, exists
// }
// 
// func (r *Registry) GetDefault() (StorageProvider, *model.StorageConfig, error) {
// 	r.mu.RLock()
// 	defer r.mu.RUnlock()
// 
// 	for id, cfg := range r.configs {
// 		if cfg.IsDefault {
// 			if provider, ok := r.providers[id]; ok {
// 				return provider, cfg, nil
// 			}
// 		}
// 	}
// 	return nil, nil, fmt.Errorf("no default storage provider found")
// }
// 
// func (r *Registry) List() []*model.StorageConfig {
// 	r.mu.RLock()
// 	defer r.mu.RUnlock()
// 
// 	configs := make([]*model.StorageConfig, 0, len(r.configs))
// 	for _, cfg := range r.configs {
// 		configs = append(configs, cfg)
// 	}
// 	return configs
// }
// 
// func (r *Registry) Close() error {
// 	r.mu.Lock()
// 	defer r.mu.Unlock()
// 
// 	var lastErr error
// 	for id, provider := range r.providers {
// 		if err := provider.Close(); err != nil {
// 			lastErr = err
// 		}
// 		delete(r.providers, id)
// 	}
// 	r.configs = make(map[string]*model.StorageConfig)
// 	return lastErr
// }
// 
// // ProviderFactory creates provider implementations from storage config.
// type ProviderFactory struct {
// 	registry *Registry
// }
// 
// func NewProviderFactory(registry *Registry) *ProviderFactory {
// 	return &ProviderFactory{registry: registry}
// }
// 
// func (f *ProviderFactory) CreateProvider(ctx context.Context, cfg *model.StorageConfig) (StorageProvider, error) {
// 	switch cfg.Provider {
// 	case model.ProviderS3, model.ProviderMinio, model.ProviderOSS, model.ProviderCOS:
// 		return NewS3Provider(ctx, &S3Config{
// 			Endpoint:     cfg.Endpoint,
// 			Region:       cfg.Region,
// 			AccessKey:    cfg.AccessKey,
// 			SecretKey:    cfg.SecretKey,
// 			Bucket:       cfg.Bucket,
// 			PathStyle:    cfg.PathStyle,
// 			ProviderType: ProviderType(cfg.Provider),
// 		})
// 	case model.ProviderLocal:
// 		return NewLocalProvider(cfg.Bucket)
// 	default:
// 		return nil, fmt.Errorf("unsupported storage provider: %s", cfg.Provider)
// 	}
// }
// 
// func (f *ProviderFactory) CreateAndRegister(ctx context.Context, cfg *model.StorageConfig) error {
// 	provider, err := f.CreateProvider(ctx, cfg)
// 	if err != nil {
// 		return err
// 	}
// 	f.registry.Register(cfg.ID, provider, cfg)
// 	return nil
// }

// -----------------------------------------------------------------------------
// FILE: internal/storage/s3_provider.go
// -----------------------------------------------------------------------------
// package storage
// 
// import (
// 	"context"
// 	"errors"
// 	"fmt"
// 	"io"
// 	"net/url"
// 	"time"
// 
// 	"github.com/aws/aws-sdk-go-v2/aws"
// 	"github.com/aws/aws-sdk-go-v2/config"
// 	"github.com/aws/aws-sdk-go-v2/credentials"
// 	"github.com/aws/aws-sdk-go-v2/service/s3"
// 	"github.com/aws/aws-sdk-go-v2/service/s3/types"
// 	"github.com/aws/smithy-go"
// )
// 
// // S3Provider supports AWS S3 and S3-compatible providers.
// type S3Provider struct {
// 	client        *s3.Client
// 	presignClient *s3.PresignClient
// 	bucket        string
// 	providerType  ProviderType
// }
// 
// type S3Config struct {
// 	Endpoint     string
// 	Region       string
// 	AccessKey    string
// 	SecretKey    string
// 	Bucket       string
// 	PathStyle    bool
// 	ProviderType ProviderType
// }
// 
// func NewS3Provider(ctx context.Context, cfg *S3Config) (*S3Provider, error) {
// 	awsCfg, err := config.LoadDefaultConfig(ctx,
// 		config.WithRegion(cfg.Region),
// 		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
// 	)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to load aws config: %w", err)
// 	}
// 
// 	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
// 		if cfg.Endpoint != "" {
// 			o.BaseEndpoint = aws.String(cfg.Endpoint)
// 		}
// 		o.UsePathStyle = cfg.PathStyle
// 	})
// 
// 	providerType := cfg.ProviderType
// 	if providerType == "" {
// 		providerType = ProviderTypeS3
// 	}
// 
// 	return &S3Provider{
// 		client:        client,
// 		presignClient: s3.NewPresignClient(client),
// 		bucket:        cfg.Bucket,
// 		providerType:  providerType,
// 	}, nil
// }
// 
// func (p *S3Provider) Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error) {
// 	options := &Options{}
// 	for _, opt := range opts {
// 		opt(options)
// 	}
// 
// 	contentType := options.ContentType
// 	if contentType == "" {
// 		contentType = "application/octet-stream"
// 	}
// 
// 	input := &s3.PutObjectInput{
// 		Bucket:      aws.String(p.bucket),
// 		Key:         aws.String(key),
// 		Body:        reader,
// 		ContentType: aws.String(contentType),
// 	}
// 	if options.Metadata != nil {
// 		input.Metadata = options.Metadata
// 	}
// 	if options.StorageClass != "" {
// 		input.StorageClass = types.StorageClass(options.StorageClass)
// 	}
// 
// 	output, err := p.client.PutObject(ctx, input)
// 	if err != nil {
// 		return nil, NewInternalError("failed to put object", err)
// 	}
// 
// 	return &ObjectInfo{
// 		Key:          key,
// 		Size:         size,
// 		ContentType:  contentType,
// 		ETag:         aws.ToString(output.ETag),
// 		LastModified: time.Now(),
// 		Metadata:     options.Metadata,
// 	}, nil
// }
// 
// func (p *S3Provider) Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error) {
// 	output, err := p.client.GetObject(ctx, &s3.GetObjectInput{
// 		Bucket: aws.String(p.bucket),
// 		Key:    aws.String(key),
// 	})
// 	if err != nil {
// 		if isNotFoundErr(err) {
// 			return nil, nil, NewNotFoundError(key, err)
// 		}
// 		return nil, nil, NewInternalError("failed to get object", err)
// 	}
// 
// 	info := &ObjectInfo{
// 		Key:          key,
// 		Size:         aws.ToInt64(output.ContentLength),
// 		ContentType:  aws.ToString(output.ContentType),
// 		ETag:         aws.ToString(output.ETag),
// 		LastModified: aws.ToTime(output.LastModified),
// 		Metadata:     output.Metadata,
// 	}
// 	return output.Body, info, nil
// }
// 
// func (p *S3Provider) Delete(ctx context.Context, key string) error {
// 	_, err := p.client.DeleteObject(ctx, &s3.DeleteObjectInput{
// 		Bucket: aws.String(p.bucket),
// 		Key:    aws.String(key),
// 	})
// 	if err != nil {
// 		return NewInternalError("failed to delete object", err)
// 	}
// 	return nil
// }
// 
// func (p *S3Provider) Stat(ctx context.Context, key string) (*ObjectInfo, error) {
// 	output, err := p.client.HeadObject(ctx, &s3.HeadObjectInput{
// 		Bucket: aws.String(p.bucket),
// 		Key:    aws.String(key),
// 	})
// 	if err != nil {
// 		if isNotFoundErr(err) {
// 			return nil, NewNotFoundError(key, err)
// 		}
// 		return nil, NewInternalError("failed to stat object", err)
// 	}
// 
// 	return &ObjectInfo{
// 		Key:          key,
// 		Size:         aws.ToInt64(output.ContentLength),
// 		ContentType:  aws.ToString(output.ContentType),
// 		ETag:         aws.ToString(output.ETag),
// 		LastModified: aws.ToTime(output.LastModified),
// 		Metadata:     output.Metadata,
// 	}, nil
// }
// 
// func (p *S3Provider) List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error) {
// 	options := &ListOptions{MaxKeys: 1000, Recursive: true}
// 	for _, opt := range opts {
// 		opt(options)
// 	}
// 
// 	input := &s3.ListObjectsV2Input{
// 		Bucket:  aws.String(p.bucket),
// 		Prefix:  aws.String(prefix),
// 		MaxKeys: aws.Int32(int32(options.MaxKeys)),
// 	}
// 	if options.Delimiter != "" {
// 		input.Delimiter = aws.String(options.Delimiter)
// 	}
// 	if options.Marker != "" {
// 		input.ContinuationToken = aws.String(options.Marker)
// 	}
// 
// 	output, err := p.client.ListObjectsV2(ctx, input)
// 	if err != nil {
// 		return nil, NewInternalError("failed to list objects", err)
// 	}
// 
// 	objects := make([]*ObjectInfo, 0, len(output.Contents))
// 	for _, obj := range output.Contents {
// 		objects = append(objects, &ObjectInfo{
// 			Key:          aws.ToString(obj.Key),
// 			Size:         aws.ToInt64(obj.Size),
// 			ETag:         aws.ToString(obj.ETag),
// 			LastModified: aws.ToTime(obj.LastModified),
// 		})
// 	}
// 	return objects, nil
// }
// 
// func (p *S3Provider) DeleteBatch(ctx context.Context, keys []string) error {
// 	objects := make([]types.ObjectIdentifier, 0, len(keys))
// 	for _, key := range keys {
// 		objects = append(objects, types.ObjectIdentifier{Key: aws.String(key)})
// 	}
// 
// 	_, err := p.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
// 		Bucket: aws.String(p.bucket),
// 		Delete: &types.Delete{Objects: objects, Quiet: aws.Bool(true)},
// 	})
// 	if err != nil {
// 		return NewInternalError("failed to delete objects batch", err)
// 	}
// 	return nil
// }
// 
// func (p *S3Provider) Copy(ctx context.Context, srcKey, dstKey string) error {
// 	copySource := url.QueryEscape(p.bucket + "/" + srcKey)
// 	_, err := p.client.CopyObject(ctx, &s3.CopyObjectInput{
// 		Bucket:     aws.String(p.bucket),
// 		Key:        aws.String(dstKey),
// 		CopySource: aws.String(copySource),
// 	})
// 	if err != nil {
// 		return NewInternalError("failed to copy object", err)
// 	}
// 	return nil
// }
// 
// func (p *S3Provider) Move(ctx context.Context, srcKey, dstKey string) error {
// 	if err := p.Copy(ctx, srcKey, dstKey); err != nil {
// 		return err
// 	}
// 	return p.Delete(ctx, srcKey)
// }
// 
// func (p *S3Provider) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
// 	presignResult, err := p.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
// 		Bucket: aws.String(p.bucket),
// 		Key:    aws.String(key),
// 	}, func(opts *s3.PresignOptions) {
// 		opts.Expires = ttl
// 	})
// 	if err != nil {
// 		return "", NewInternalError("failed to presign put url", err)
// 	}
// 	return presignResult.URL, nil
// }
// 
// func (p *S3Provider) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
// 	presignResult, err := p.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
// 		Bucket: aws.String(p.bucket),
// 		Key:    aws.String(key),
// 	}, func(opts *s3.PresignOptions) {
// 		opts.Expires = ttl
// 	})
// 	if err != nil {
// 		return "", NewInternalError("failed to presign get url", err)
// 	}
// 	return presignResult.URL, nil
// }
// 
// func (p *S3Provider) CreateBucket(ctx context.Context, bucket string) error {
// 	_, err := p.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
// 	if err != nil {
// 		return NewInternalError("failed to create bucket", err)
// 	}
// 	return nil
// }
// 
// func (p *S3Provider) DeleteBucket(ctx context.Context, bucket string) error {
// 	_, err := p.client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
// 	if err != nil {
// 		return NewInternalError("failed to delete bucket", err)
// 	}
// 	return nil
// }
// 
// func (p *S3Provider) BucketExists(ctx context.Context, bucket string) (bool, error) {
// 	_, err := p.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
// 	if err != nil {
// 		if isNotFoundErr(err) {
// 			return false, nil
// 		}
// 		return false, NewInternalError("failed to check bucket exists", err)
// 	}
// 	return true, nil
// }
// 
// func (p *S3Provider) Type() ProviderType {
// 	return p.providerType
// }
// 
// func (p *S3Provider) Close() error {
// 	return nil
// }
// 
// func isNotFoundErr(err error) bool {
// 	var apiErr smithy.APIError
// 	if errors.As(err, &apiErr) {
// 		switch apiErr.ErrorCode() {
// 		case "NoSuchKey", "NotFound", "404", "NoSuchBucket":
// 			return true
// 		}
// 	}
// 	return false
// }

// -----------------------------------------------------------------------------
// FILE: pkg/auth/aksk.go
// -----------------------------------------------------------------------------
// package auth
// 
// import (
// 	"crypto/hmac"
// 	"crypto/rand"
// 	"crypto/sha256"
// 	"encoding/base64"
// 	"encoding/hex"
// 	"errors"
// 	"fmt"
// 	"io"
// 	"strings"
// 	"time"
// )
// 
// const (
// 	AKPrefix           = "AK"
// 	TimestampHeaderKey = "X-BVault-Timestamp"
// )
// 
// func GenerateAKSK() (string, string, error) {
// 	ak, err := randomString(18)
// 	if err != nil {
// 		return "", "", err
// 	}
// 	sk, err := randomString(42)
// 	if err != nil {
// 		return "", "", err
// 	}
// 	return AKPrefix + ak, sk, nil
// }
// 
// func ParseAKSKAuthorization(header string) (accessKey, signature string, err error) {
// 	header = strings.TrimSpace(header)
// 	if header == "" {
// 		return "", "", errors.New("empty authorization header")
// 	}
// 
// 	if strings.HasPrefix(strings.ToUpper(header), AKPrefix+" ") {
// 		header = strings.TrimSpace(header[len(AKPrefix):])
// 	}
// 
// 	parts := strings.SplitN(header, ":", 2)
// 	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
// 		return "", "", errors.New("invalid AK/SK authorization format")
// 	}
// 	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
// }
// 
// func BuildCanonicalString(method, requestPath, rawQuery, timestamp, bodySHA256 string) string {
// 	method = strings.ToUpper(strings.TrimSpace(method))
// 	requestPath = strings.TrimSpace(requestPath)
// 	if requestPath == "" {
// 		requestPath = "/"
// 	}
// 
// 	items := []string{method, requestPath, strings.TrimSpace(rawQuery), strings.TrimSpace(timestamp), strings.TrimSpace(bodySHA256)}
// 	return strings.Join(items, "\n")
// }
// 
// func SignAKSK(secretKey, canonical string) string {
// 	h := hmac.New(sha256.New, []byte(secretKey))
// 	_, _ = io.WriteString(h, canonical)
// 	return hex.EncodeToString(h.Sum(nil))
// }
// 
// func VerifyAKSKSignature(secretKey, canonical, signature string) bool {
// 	expected := SignAKSK(secretKey, canonical)
// 	return hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(strings.TrimSpace(signature))))
// }
// 
// func Sha256Hex(data []byte) string {
// 	sum := sha256.Sum256(data)
// 	return hex.EncodeToString(sum[:])
// }
// 
// func TimestampWithinWindow(value string, window time.Duration) bool {
// 	t, err := time.Parse(time.RFC3339, strings.TrimSpace(value))
// 	if err != nil {
// 		return false
// 	}
// 	now := time.Now()
// 	if t.After(now.Add(window)) {
// 		return false
// 	}
// 	return now.Sub(t) <= window
// }
// 
// func randomString(size int) (string, error) {
// 	buf := make([]byte, size)
// 	if _, err := rand.Read(buf); err != nil {
// 		return "", fmt.Errorf("failed to read random bytes: %w", err)
// 	}
// 	return base64.RawURLEncoding.EncodeToString(buf), nil
// }

// -----------------------------------------------------------------------------
// FILE: pkg/auth/jwt.go
// -----------------------------------------------------------------------------
// package auth
// 
// import (
// 	"errors"
// 	"strings"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/config"
// 	"github.com/golang-jwt/jwt/v5"
// )
// 
// // Claims carries authentication identity fields.
// type Claims struct {
// 	UserID   string `json:"user_id"`
// 	TenantID string `json:"tenant_id"`
// 	Username string `json:"username"`
// 	jwt.RegisteredClaims
// }
// 
// // JWTManager handles JWT issue/validate.
// type JWTManager struct {
// 	secret []byte
// 	issuer string
// 	ttl    time.Duration
// }
// 
// func NewJWTManager(cfg config.JWTConfig) *JWTManager {
// 	ttl := cfg.ExpireTime
// 	if ttl <= 0 {
// 		ttl = 24 * time.Hour
// 	}
// 	return &JWTManager{
// 		secret: []byte(cfg.Secret),
// 		issuer: cfg.Issuer,
// 		ttl:    ttl,
// 	}
// }
// 
// func (m *JWTManager) GenerateToken(userID, tenantID, username string) (string, time.Time, error) {
// 	now := time.Now()
// 	expireAt := now.Add(m.ttl)
// 
// 	claims := &Claims{
// 		UserID:   userID,
// 		TenantID: tenantID,
// 		Username: username,
// 		RegisteredClaims: jwt.RegisteredClaims{
// 			Issuer:    m.issuer,
// 			IssuedAt:  jwt.NewNumericDate(now),
// 			ExpiresAt: jwt.NewNumericDate(expireAt),
// 		},
// 	}
// 
// 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
// 	tokenString, err := token.SignedString(m.secret)
// 	if err != nil {
// 		return "", time.Time{}, err
// 	}
// 	return tokenString, expireAt, nil
// }
// 
// func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
// 	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
// 		if token.Method != jwt.SigningMethodHS256 {
// 			return nil, errors.New("unexpected signing method")
// 		}
// 		return m.secret, nil
// 	})
// 	if err != nil {
// 		return nil, err
// 	}
// 
// 	claims, ok := token.Claims.(*Claims)
// 	if !ok || !token.Valid {
// 		return nil, errors.New("invalid token")
// 	}
// 	if m.issuer != "" && claims.Issuer != m.issuer {
// 		return nil, errors.New("invalid token issuer")
// 	}
// 	return claims, nil
// }
// 
// func ExtractBearerToken(authHeader string) (string, error) {
// 	parts := strings.SplitN(strings.TrimSpace(authHeader), " ", 2)
// 	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
// 		return "", errors.New("invalid bearer token format")
// 	}
// 	return strings.TrimSpace(parts[1]), nil
// }

// -----------------------------------------------------------------------------
// FILE: pkg/database/postgres.go
// -----------------------------------------------------------------------------
// package database
// 
// import (
// 	"fmt"
// 	"time"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/config"
// 	"github.com/baobaobao/baobaobaivault/internal/model"
// 	"go.uber.org/zap"
// 	"gorm.io/driver/postgres"
// 	"gorm.io/gorm"
// 	"gorm.io/gorm/logger"
// )
// 
// // NewPostgresDB 鍒涘缓 PostgreSQL 鏁版嵁搴撹繛鎺?func NewPostgresDB(cfg config.DatabaseConfig, log *zap.Logger) (*gorm.DB, error) {
// 	dsn := fmt.Sprintf(
// 		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
// 		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
// 	)
// 
// 	gormConfig := &gorm.Config{
// 		Logger: logger.Default.LogMode(logger.Info),
// 	}
// 
// 	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to connect database: %w", err)
// 	}
// 
// 	// 鑾峰彇搴曞眰 sql.DB
// 	sqlDB, err := db.DB()
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
// 	}
// 
// 	// 璁剧疆杩炴帴姹?	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
// 	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
// 	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)
// 
// 	log.Info("Database connected",
// 		zap.String("host", cfg.Host),
// 		zap.Int("port", cfg.Port),
// 		zap.String("database", cfg.DBName),
// 	)
// 
// 	return db, nil
// }
// 
// // AutoMigrate 鑷姩杩佺Щ鏁版嵁搴撹〃
// func AutoMigrate(db *gorm.DB) error {
// 	return db.AutoMigrate(
// 		// 绉熸埛鐩稿叧
// 		&model.Tenant{},
// 		&model.Namespace{},
// 
// 		// 鐢ㄦ埛鏉冮檺鐩稿叧
// 		&model.User{},
// 		&model.Role{},
// 		&model.Permission{},
// 
// 		// 瀛樺偍鐩稿叧
// 		&model.StorageConfig{},
// 		&model.Object{},
// 		&model.ObjectVersion{},
// 
// 		// AKSK
// 		&model.AKSK{},
// 
// 		// 瀹¤鏃ュ織
// 		&model.AuditLog{},
// 	)
// }
// 
// // Close 鍏抽棴鏁版嵁搴撹繛鎺?func Close(db *gorm.DB) error {
// 	sqlDB, err := db.DB()
// 	if err != nil {
// 		return err
// 	}
// 	return sqlDB.Close()
// }

// -----------------------------------------------------------------------------
// FILE: pkg/redis/client.go
// -----------------------------------------------------------------------------
// package redis
// 
// import (
// 	"context"
// 	"encoding/json"
// 	"errors"
// 	"time"
// 
// 	goredis "github.com/redis/go-redis/v9"
// )
// 
// // Client wraps common Redis operations used by services and middleware.
// type Client struct {
// 	raw *goredis.Client
// }
// 
// func New(client *goredis.Client) *Client {
// 	return &Client{raw: client}
// }
// 
// func (c *Client) Raw() *goredis.Client {
// 	return c.raw
// }
// 
// func (c *Client) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
// 	if c.raw == nil {
// 		return errors.New("redis client is nil")
// 	}
// 	data, err := json.Marshal(value)
// 	if err != nil {
// 		return err
// 	}
// 	return c.raw.Set(ctx, key, data, ttl).Err()
// }
// 
// func (c *Client) GetJSON(ctx context.Context, key string, dest any) error {
// 	if c.raw == nil {
// 		return errors.New("redis client is nil")
// 	}
// 	val, err := c.raw.Get(ctx, key).Result()
// 	if err != nil {
// 		return err
// 	}
// 	return json.Unmarshal([]byte(val), dest)
// }
// 
// // IncrWithExpire increments a key and ensures expiration is set.
// func (c *Client) IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error) {
// 	if c.raw == nil {
// 		return 0, errors.New("redis client is nil")
// 	}
// 	pipe := c.raw.TxPipeline()
// 	incr := pipe.Incr(ctx, key)
// 	pipe.Expire(ctx, key, ttl)
// 	if _, err := pipe.Exec(ctx); err != nil {
// 		return 0, err
// 	}
// 	return incr.Val(), nil
// }

// -----------------------------------------------------------------------------
// FILE: pkg/redis/redis.go
// -----------------------------------------------------------------------------
// package redis
// 
// import (
// 	"context"
// 	"fmt"
// 
// 	"github.com/baobaobao/baobaobaivault/internal/config"
// 	"github.com/redis/go-redis/v9"
// 	"go.uber.org/zap"
// )
// 
// // NewClient 鍒涘缓 Redis 瀹㈡埛绔?func NewClient(cfg config.RedisConfig, log *zap.Logger) (*redis.Client, error) {
// 	client := redis.NewClient(&redis.Options{
// 		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
// 		Password: cfg.Password,
// 		DB:       cfg.DB,
// 	})
// 
// 	// 娴嬭瘯杩炴帴
// 	ctx := context.Background()
// 	if err := client.Ping(ctx).Err(); err != nil {
// 		return nil, fmt.Errorf("failed to connect redis: %w", err)
// 	}
// 
// 	log.Info("Redis connected",
// 		zap.String("addr", fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)),
// 		zap.Int("db", cfg.DB),
// 	)
// 
// 	return client, nil
// }
// 
// // Close 鍏抽棴 Redis 杩炴帴
// func Close(client *redis.Client) error {
// 	return client.Close()
// }

