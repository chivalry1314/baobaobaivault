package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strconv"
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
	h.writeAuditLog(c, "update_role", "user", c.Param("userId"), fmt.Sprintf("role updated to %s", req.Role), "success")
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

	h.writeAuditLog(c, "delete", "user", c.Param("userId"), "", "success")
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

	h.writeAuditLog(c, "reset_password", "user", c.Param("userId"), "", "success")
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

func (h *Handler) shareSystemSiteBrandingSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	settings, err := h.shareService.GetShareSiteBrandingSettings(c.Request.Context(), user.ID)
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

	h.writeAuditLog(c, "update", "media_storage", "", fmt.Sprintf("storageMode=%s", req.StorageMode), "success")
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

	h.writeAuditLog(c, "run_migration", "media_storage", "", fmt.Sprintf("processed=%d", result.Processed), "success")
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

	h.writeAuditLog(c, "update", "auth_settings", "", fmt.Sprintf("emailVerificationEnabled=%v", req.EmailVerificationEnabled), "success")
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareSystemUpdateSiteBrandingSettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		SiteName             string `json:"siteName"`
		SiteShortName        string `json:"siteShortName"`
		SiteDescription      string `json:"siteDescription"`
		SiteSubtitle         string `json:"siteSubtitle"`
		ShowSiteSubtitle     bool   `json:"showSiteSubtitle"`
		AuthSubtitle         string `json:"authSubtitle"`
		ShowAuthSubtitle     bool   `json:"showAuthSubtitle"`
		LogoText             string `json:"logoText"`
		LogoBadgeText        string `json:"logoBadgeText"`
		LogoImageSrc         string `json:"logoImageSrc"`
		LogoOriginalFileName string `json:"logoOriginalFileName"`
		LogoMimeType         string `json:"logoMimeType"`
		FooterText           string `json:"footerText"`
		DefaultDisplayName   string `json:"defaultDisplayName"`
		DefaultCreatorName   string `json:"defaultCreatorName"`
		DefaultCreatorHandle string `json:"defaultCreatorHandle"`
		DefaultInitials      string `json:"defaultInitials"`
		CreatorTagline       string `json:"creatorTagline"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := h.shareService.UpdateShareSiteBrandingSettings(c.Request.Context(), service.ShareUpdateSiteBrandingSettingsInput{
		OperatorID:           user.ID,
		SiteName:             req.SiteName,
		SiteShortName:        req.SiteShortName,
		SiteDescription:      req.SiteDescription,
		SiteSubtitle:         req.SiteSubtitle,
		ShowSiteSubtitle:     req.ShowSiteSubtitle,
		AuthSubtitle:         req.AuthSubtitle,
		ShowAuthSubtitle:     req.ShowAuthSubtitle,
		LogoText:             req.LogoText,
		LogoBadgeText:        req.LogoBadgeText,
		LogoImageSrc:         req.LogoImageSrc,
		LogoOriginalFileName: req.LogoOriginalFileName,
		LogoMimeType:         req.LogoMimeType,
		FooterText:           req.FooterText,
		DefaultDisplayName:   req.DefaultDisplayName,
		DefaultCreatorName:   req.DefaultCreatorName,
		DefaultCreatorHandle: req.DefaultCreatorHandle,
		DefaultInitials:      req.DefaultInitials,
		CreatorTagline:       req.CreatorTagline,
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
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.writeAuditLog(c, "update", "site_branding", "", "site branding settings updated", "success")
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareSystemUploadSiteBrandingLogo(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	mimeType := strings.TrimSpace(c.PostForm("content_type"))
	if mimeType == "" {
		mimeType = strings.TrimSpace(header.Header.Get("Content-Type"))
	}

	settings, err := h.shareService.UploadShareSiteBrandingLogo(c.Request.Context(), service.ShareUploadSiteBrandingLogoInput{
		OperatorID:  user.ID,
		FileName:    header.Filename,
		MimeType:    mimeType,
		FileReader:  file,
		MaxFileSize: header.Size,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole), errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.writeAuditLog(c, "upload_logo", "site_branding_logo", "", fmt.Sprintf("filename=%s", header.Filename), "success")
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) sharePublicSiteBrandingSettings(c *gin.Context) {
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.JSON(http.StatusOK, gin.H{
		"settings": h.shareService.GetSharePublicSiteBrandingSettings(),
	})
}

func (h *Handler) sharePublicMediaStorageSettings(c *gin.Context) {
	c.JSON(http.StatusOK, h.shareService.GetSharePublicMediaStorageSettings())
}

func (h *Handler) sharePublicSiteBrandingLogo(c *gin.Context) {
	stream, fileName, mimeType, err := h.shareService.OpenShareSiteBrandingLogo(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "object not found"})
		return
	}
	defer stream.Reader.Close()

	if strings.TrimSpace(mimeType) == "" {
		mimeType = "application/octet-stream"
	}
	c.Header("Content-Type", mimeType)
	if stream.Size > 0 {
		c.Header("Content-Length", strconv.FormatInt(stream.Size, 10))
	}
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, strings.ReplaceAll(fileName, `"`, "_")))
	c.Status(http.StatusOK)
	if _, copyErr := io.Copy(c.Writer, stream.Reader); copyErr != nil {
		c.Error(copyErr)
	}
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
		h.writeAuditLog(c, "smtp_test", "email", "", fmt.Sprintf("target=%s", targetEmail), "failure")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.writeAuditLog(c, "smtp_test", "email", "", fmt.Sprintf("target=%s", targetEmail), "success")
	h.markShareSMTPTestSent(user.ID)
	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"targetEmail": targetEmail,
	})
}

func (h *Handler) shareSystemCategorySettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	settings, err := h.shareService.GetShareCategorySettings(c.Request.Context(), user.ID)
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

func (h *Handler) shareSystemUpdateCategorySettings(c *gin.Context) {
	user, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req service.ShareCategorySettingsView
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := h.shareService.UpdateShareCategorySettings(c.Request.Context(), user.ID, req)
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

	h.writeAuditLog(c, "update_category_settings", "system", "", "", "success")
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) sharePublicCategorySettings(c *gin.Context) {
	settings, err := h.shareService.GetShareCategorySettings(c.Request.Context(), "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}
