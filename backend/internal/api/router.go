package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/baobaobai/baobaobaivault/internal/storage"
	webpushsvc "github.com/baobaobai/baobaobaivault/internal/webpush"
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
	namespaceService *service.NamespaceService
	storageService   *service.StorageService
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
	storageService := service.NewStorageService(db, logger, registry)
	emailService := service.NewEmailService(cfg.Email)
	h := &Handler{
		cfg:              cfg,
		db:               db,
		redis:            rdb,
		logger:           logger,
		namespaceService: service.NewNamespaceService(db, logger),
		storageService:   storageService,
		registry:         registry,
		shareService:     service.NewShareService(db, logger, storageService, filepath.Join("storage", "share", "files"), cfg.ShareAuth, emailService, cfg.Server.AdminEmail),
		shareSMTPTestAt:  make(map[string]time.Time),
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

	return r
}

func (h *Handler) ensureNamespaceOwnerExists(ctx context.Context, ownerUserID string) error {
	ownerUserID = strings.TrimSpace(ownerUserID)
	if ownerUserID == "" {
		return nil
	}
	var count int64
	if err := h.db.WithContext(ctx).Model(&model.ShareExternalUser{}).Where("id = ?", ownerUserID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	if err := h.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", ownerUserID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("owner user not found")
	}
	return nil
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
