package api

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/baobaobai/baobaobaivault/internal/service"
	authpkg "github.com/baobaobai/baobaobaivault/pkg/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AuthMiddleware supports JWT and AK/SK dual authentication.
type AuthMiddleware struct {
	db          *gorm.DB
	userService *service.UserService
}

func NewAuthMiddleware(db *gorm.DB, userService *service.UserService) *AuthMiddleware {
	return &AuthMiddleware{db: db, userService: userService}
}

func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
		if authorization == "" {
			jsonError(c, http.StatusUnauthorized, errors.New("missing Authorization header"))
			c.Abort()
			return
		}

		if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
			if err := m.authenticateJWT(c, authorization); err != nil {
				jsonError(c, http.StatusUnauthorized, err)
				c.Abort()
				return
			}
			c.Next()
			return
		}

		if err := m.authenticateAKSK(c, authorization); err != nil {
			jsonError(c, http.StatusUnauthorized, err)
			c.Abort()
			return
		}
		c.Next()
	}
}

func (m *AuthMiddleware) RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := getUserID(c)
		tenantID := getTenantID(c)
		if userID == "" || tenantID == "" {
			jsonError(c, http.StatusUnauthorized, errors.New("invalid auth context"))
			c.Abort()
			return
		}

		allowed, err := m.hasPermission(c, userID, tenantID, resource, action)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err)
			c.Abort()
			return
		}
		if !allowed {
			jsonError(c, http.StatusForbidden, errors.New("permission denied"))
			c.Abort()
			return
		}
		c.Next()
	}
}

func (m *AuthMiddleware) authenticateJWT(c *gin.Context, authorization string) error {
	token, err := authpkg.ExtractBearerToken(authorization)
	if err != nil {
		return err
	}

	claims, err := m.userService.ValidateToken(token)
	if err != nil {
		return err
	}

	userID := claimToString(*claims, "user_id")
	tenantID := claimToString(*claims, "tenant_id")
	username := claimToString(*claims, "username")
	if userID == "" || tenantID == "" {
		return errors.New("token missing required claims")
	}

	c.Set(ctxUserID, userID)
	c.Set(ctxTenantID, tenantID)
	c.Set(ctxUsername, username)
	c.Set(ctxAuthType, "jwt")
	return nil
}

func (m *AuthMiddleware) authenticateAKSK(c *gin.Context, authorization string) error {
	accessKey, signature, err := authpkg.ParseAKSKAuthorization(authorization)
	if err != nil {
		return err
	}

	timestamp := strings.TrimSpace(c.GetHeader(authpkg.TimestampHeaderKey))
	if timestamp == "" || !authpkg.TimestampWithinWindow(timestamp, 5*time.Minute) {
		return errors.New("invalid or expired AK/SK timestamp")
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return errors.New("failed to read request body")
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	canonical := authpkg.BuildCanonicalString(
		c.Request.Method,
		c.Request.URL.Path,
		c.Request.URL.RawQuery,
		timestamp,
		authpkg.Sha256Hex(body),
	)

	var credential model.AKSK
	if err := m.db.WithContext(c.Request.Context()).
		Preload("User").
		First(&credential, "access_key = ? AND status = ?", accessKey, model.AKSKStatusActive).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invalid access key")
		}
		return err
	}

	if credential.ExpiresAt != nil && credential.ExpiresAt.Before(time.Now()) {
		return errors.New("AK/SK expired")
	}
	if !authpkg.VerifyAKSKSignature(credential.SecretKey, canonical, signature) {
		return errors.New("invalid signature")
	}
	if credential.User != nil && credential.User.Status != model.UserStatusActive {
		return errors.New("user is not active")
	}

	c.Set(ctxUserID, credential.UserID)
	c.Set(ctxTenantID, credential.TenantID)
	if credential.User != nil {
		c.Set(ctxUsername, credential.User.Username)
	}
	c.Set(ctxAuthType, "aksk")
	return nil
}

func (m *AuthMiddleware) hasPermission(c *gin.Context, userID, tenantID, resource, action string) (bool, error) {
	var count int64

	if err := m.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND roles.tenant_id IS NULL", userID, model.RoleCodePlatformAdmin).
		Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}

	if err := m.db.WithContext(c.Request.Context()).
		Table("roles").
		Joins("JOIN user_roles ur ON ur.role_id = roles.id").
		Where("ur.user_id = ? AND roles.code = ? AND (roles.tenant_id = ? OR roles.tenant_id IS NULL)", userID, model.RoleCodeTenantAdmin, tenantID).
		Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}

	count = 0
	err := m.db.WithContext(c.Request.Context()).
		Table("permissions").
		Joins("JOIN role_permissions rp ON rp.permission_id = permissions.id").
		Joins("JOIN roles r ON r.id = rp.role_id").
		Joins("JOIN user_roles ur ON ur.role_id = r.id").
		Where("ur.user_id = ?", userID).
		Where("r.tenant_id = ? OR r.tenant_id IS NULL", tenantID).
		Where("permissions.resource = ?", resource).
		Where("permissions.action = ? OR permissions.action = ?", action, string(model.ActionAdmin)).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func claimToString(claims map[string]any, key string) string {
	v, ok := claims[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if ok {
		return s
	}
	return ""
}
