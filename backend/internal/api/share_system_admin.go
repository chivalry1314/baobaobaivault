package api

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
)

func (h *Handler) shareSystemUsers(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	page, pageSize := parsePage(c)
	users, total, err := h.shareService.ListUsersForRoleManage(c.Request.Context(), service.ShareListUsersForRoleManageInput{
		OperatorID: user.ID,
		Page:       page,
		PageSize:   pageSize,
		Keyword:    strings.TrimSpace(c.Query("keyword")),
		Role:       strings.TrimSpace(c.Query("role")),
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareInvalidUserRole):
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"pagination": gin.H{
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (h *Handler) shareSystemUpdateUserRole(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	updated, err := h.shareService.UpdateUserRole(c.Request.Context(), service.ShareUpdateUserRoleInput{
		OperatorID: user.ID,
		UserID:     c.Param("userId"),
		Role:       req.Role,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	updated.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(updated)
	c.JSON(http.StatusOK, gin.H{"user": updated})
}

func (h *Handler) shareSystemDeleteUser(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	err := h.shareService.DeleteUserForManage(c.Request.Context(), service.ShareDeleteUserInput{
		OperatorID: user.ID,
		UserID:     c.Param("userId"),
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareSelfDelete),
			errors.Is(err, service.ErrShareLastManagerDelete),
			errors.Is(err, service.ErrShareProtectedSuperAdmin):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareSystemResetUserPassword(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	result, err := h.shareService.AdminResetExternalUserPassword(c.Request.Context(), service.ShareAdminResetUserPasswordInput{
		OperatorID: user.ID,
		UserID:     c.Param("userId"),
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareProtectedSuperAdmin):
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"newPassword": result.NewPassword,
	})
}

func (h *Handler) shareSystemAuthSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	settings, err := h.shareService.GetShareAuthSettings(c.Request.Context(), user.ID)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareSystemMediaStorageSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	settings, err := h.shareService.GetShareMediaStorageSettings(c.Request.Context(), user.ID)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	migration, err := h.shareService.GetShareMediaStorageMigrationPlan(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"settings":  settings,
		"migration": migration,
	})
}

func (h *Handler) shareSystemUpdateMediaStorageSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		StorageMode          string `json:"storageMode"`
		LocalFallbackEnabled bool   `json:"localFallbackEnabled"`
		CoverNamespaceID     string `json:"coverNamespaceID"`
		AssetNamespaceID     string `json:"assetNamespaceID"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := h.shareService.UpdateShareMediaStorageSettings(c.Request.Context(), service.ShareUpdateMediaStorageSettingsInput{
		OperatorID:           user.ID,
		StorageMode:          req.StorageMode,
		LocalFallbackEnabled: req.LocalFallbackEnabled,
		CoverNamespaceID:     req.CoverNamespaceID,
		AssetNamespaceID:     req.AssetNamespaceID,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	migration, err := h.shareService.GetShareMediaStorageMigrationPlan(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"settings":  settings,
		"migration": migration,
	})
}

func (h *Handler) shareSystemRunMediaStorageMigration(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		BatchSize      int  `json:"batchSize"`
		DeleteLocal    bool `json:"deleteLocal"`
		IncludeMissing bool `json:"includeMissing"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := h.shareService.RunShareMediaStorageMigration(c.Request.Context(), service.ShareMediaStorageMigrationRunInput{
		OperatorID:     user.ID,
		BatchSize:      req.BatchSize,
		DeleteLocal:    req.DeleteLocal,
		IncludeMissing: req.IncludeMissing,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		default:
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	settings, err := h.shareService.GetShareMediaStorageSettings(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	migration, err := h.shareService.GetShareMediaStorageMigrationPlan(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"settings":  settings,
		"migration": migration,
		"result":    result,
	})
}

func (h *Handler) shareSystemUpdateAuthSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		EmailVerificationEnabled   bool `json:"emailVerificationEnabled"`
		VerificationCodeTTLSeconds int  `json:"verificationCodeTTLSeconds"`
		ResendIntervalSeconds      int  `json:"resendIntervalSeconds"`
		MaxVerifyAttempts          int  `json:"maxVerifyAttempts"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := h.shareService.UpdateShareAuthSettings(c.Request.Context(), service.ShareUpdateAuthSettingsInput{
		OperatorID:                 user.ID,
		EmailVerificationEnabled:   req.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: req.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:      req.ResendIntervalSeconds,
		MaxVerifyAttempts:          req.MaxVerifyAttempts,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareSystemSendSMTPTest(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		TargetEmail string `json:"targetEmail"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	targetEmail := strings.TrimSpace(req.TargetEmail)
	if targetEmail == "" {
		targetEmail = strings.TrimSpace(h.cfg.Server.AdminEmail)
	}
	if targetEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "server admin email is not configured"})
		return
	}

	targetEmail = strings.ToLower(targetEmail)
	if _, err := mail.ParseAddress(targetEmail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
		return
	}
	if retryAfter, blocked := h.shareSMTPTestRetryAfter(user.ID); blocked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":      "smtp test requested too frequently",
			"retryAfter": int(retryAfter.Seconds()),
		})
		return
	}

	emailService := service.NewEmailService(h.cfg.Email)
	if err := emailService.SendTestEmail(targetEmail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.markShareSMTPTestSent(user.ID)
	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"targetEmail": targetEmail,
	})
}
