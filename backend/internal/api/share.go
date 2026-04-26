package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	shareSessionCookieName     = "share_external_session"
	shareSessionTTL            = 30 * 24 * time.Hour
	shareFallbackMaxUploadSize = int64(10 * 1024 * 1024 * 1024)
	ctxShareUser               = "share_user"
)

func (h *Handler) registerShareRoutes(r *gin.Engine) {
	group := r.Group("/api/share")
	{
		auth := group.Group("/auth")
		{
			auth.POST("/continue", h.shareContinue)
			auth.POST("/register", h.shareRegister)
			auth.POST("/login", h.shareLogin)
			auth.POST("/logout", h.shareLogout)
			auth.GET("/session", h.shareSession)
		}

		group.GET("/discover/cards", h.shareDiscoverCards)
		group.GET("/users/:userId/assets/:fileName", h.shareUserAsset)
		group.GET("/cards/:cardId", h.shareCardDetail)
		group.GET("/cards/:cardId/preview", h.shareCardPreview)
		group.GET("/cards/:cardId/download", h.shareCardDownload)

		me := group.Group("/me")
		me.Use(h.shareRequireAuth())
		{
			me.PATCH("/profile", h.shareUpdateProfile)
			me.POST("/password", h.shareChangePassword)
			me.GET("/cards", h.shareMyCards)
			me.GET("/access-codes", h.shareMyAccessCodes)
			me.POST("/cards", h.shareCreateCard)
			me.PATCH("/cards/:cardId", h.shareUpdateCard)
			me.GET("/cards/:cardId/access-code", h.shareGetCardAccessCode)
			me.PUT("/cards/:cardId/access-code", h.shareUpdateCardAccessCode)
			me.DELETE("/cards/:cardId/access-code", h.shareDeleteCardAccessCode)
			me.DELETE("/cards/:cardId", h.shareDeleteCard)
		}
	}
}

func (h *Handler) shareRequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := h.resolveShareSessionUser(c)
		if err != nil {
			jsonError(c, http.StatusUnauthorized, err)
			c.Abort()
			return
		}
		if user == nil {
			jsonError(c, http.StatusUnauthorized, errors.New("authentication required"))
			c.Abort()
			return
		}

		c.Set(ctxShareUser, user)
		c.Next()
	}
}

func (h *Handler) shareRegister(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Nickname string `json:"nickname"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.shareService.RegisterExternalUser(c.Request.Context(), req.Email, req.Nickname, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrShareEmailExists) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.setShareSessionCookie(c, user.ID)
	c.JSON(http.StatusCreated, gin.H{"ok": true, "user": user})
}

func (h *Handler) shareContinue(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, created, err := h.shareService.ContinueExternalUser(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareInvalidEmail), errors.Is(err, service.ErrShareWeakPassword):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrShareAuthFailed):
			status = http.StatusUnauthorized
		case errors.Is(err, service.ErrShareEmailExists):
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.setShareSessionCookie(c, user.ID)
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{"ok": true, "created": created, "user": user})
}

func (h *Handler) shareLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.shareService.AuthenticateExternalUser(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		status := http.StatusUnauthorized
		if !errors.Is(err, service.ErrShareAuthFailed) {
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.setShareSessionCookie(c, user.ID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "user": user})
}

func (h *Handler) shareLogout(c *gin.Context) {
	h.clearShareSessionCookie(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareSession(c *gin.Context) {
	user, err := h.resolveShareSessionUser(c)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"authenticated": false, "user": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": user})
}

func (h *Handler) shareDiscoverCards(c *gin.Context) {
	cards, err := h.shareService.ListDiscoverCards(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"cards": cards})
}

func (h *Handler) shareUserAsset(c *gin.Context) {
	fileName := filepath.Base(strings.TrimSpace(c.Param("fileName")))
	userID := strings.TrimSpace(c.Param("userId"))
	if userID == "" || fileName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	file, stat, err := h.shareService.OpenProfileAsset(userID, fileName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", profileAssetContentType(fileName))
	c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
	c.Header("Content-Disposition", inlineDisposition(fileName))
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeContent(c.Writer, c.Request, fileName, stat.ModTime(), file)
}

func (h *Handler) shareCardDetail(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	detail, err := h.shareService.GetCardDetail(c.Request.Context(), c.Param("cardId"), viewerUserID)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *Handler) shareCardPreview(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, err := h.shareService.CanAccessCardFile(c.Request.Context(), c.Param("cardId"), viewerUserID)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(card.MimeType)), "image/") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "preview only supports image cards"})
		return
	}

	file, stat, err := h.shareService.OpenCardFile(card)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", card.MimeType)
	c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
	c.Header("Content-Disposition", inlineDisposition(card.OriginalFileName))
	c.Header("Cache-Control", "no-store")
	http.ServeContent(c.Writer, c.Request, card.OriginalFileName, stat.ModTime(), file)
}

func (h *Handler) shareCardDownload(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, consumeAccessCode, err := h.shareService.CanDownloadCardFile(c.Request.Context(), c.Param("cardId"), viewerUserID, c.Query("code"))
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareInvalidAccessCode),
			errors.Is(err, service.ErrShareAccessCodeRequired),
			errors.Is(err, service.ErrShareAccessCodeExpired),
			errors.Is(err, service.ErrShareAccessCodeExhausted):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	file, stat, err := h.shareService.OpenCardFile(card)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	if err := h.shareService.RecordDownload(c.Request.Context(), card.ID, stringPointerIfNotEmpty(viewerUserID), "download", consumeAccessCode); err != nil {
		if errors.Is(err, service.ErrShareAccessCodeExhausted) {
			jsonError(c, http.StatusForbidden, err)
			return
		}
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	c.Header("Content-Type", card.MimeType)
	c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
	c.Header("Content-Disposition", toAttachmentDisposition(card.OriginalFileName))
	c.Header("Cache-Control", "no-store")
	http.ServeContent(c.Writer, c.Request, card.OriginalFileName, stat.ModTime(), file)
}

func (h *Handler) shareMyCards(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	dashboard, err := h.shareService.ListDashboardByUser(c.Request.Context(), user.ID)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, dashboard)
}

func (h *Handler) shareMyAccessCodes(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	dashboard, err := h.shareService.ListAccessCodeDashboardByUser(c.Request.Context(), user.ID)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, dashboard)
}

func (h *Handler) shareUpdateProfile(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Nickname   string `json:"nickname"`
		Avatar     string `json:"avatar"`
		Bio        string `json:"bio"`
		CoverImage string `json:"coverImage"`
		Phone      string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	updated, err := h.shareService.UpdateExternalUserProfile(c.Request.Context(), service.ShareUpdateProfileInput{
		UserID:     user.ID,
		Nickname:   req.Nickname,
		Avatar:     req.Avatar,
		Bio:        req.Bio,
		CoverImage: req.CoverImage,
		Phone:      req.Phone,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "user": updated})
}

func (h *Handler) shareChangePassword(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.shareService.ChangeExternalUserPassword(c.Request.Context(), service.ShareChangePasswordInput{
		UserID:      user.ID,
		OldPassword: req.OldPassword,
		NewPassword: req.NewPassword,
	}); err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareCreateCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	maxUploadSize := h.cfg.Storage.MaxFileSize
	if maxUploadSize <= 0 {
		maxUploadSize = shareFallbackMaxUploadSize
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize+(1<<20))

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) || strings.Contains(strings.ToLower(err.Error()), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": service.ErrShareFileTooLarge.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrShareFileRequired.Error()})
		return
	}
	defer file.Close()

	card, err := h.shareService.CreateCard(c.Request.Context(), service.ShareCreateCardInput{
		CreatorID:   user.ID,
		Title:       c.PostForm("title"),
		Description: c.PostForm("description"),
		Visibility:  c.PostForm("visibility"),
		Status:      c.PostForm("status"),
		FileName:    header.Filename,
		MimeType:    header.Header.Get("Content-Type"),
		FileReader:  file,
		MaxFileSize: maxUploadSize,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"card": card})
}

func (h *Handler) shareUpdateCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Visibility  string `json:"visibility"`
		Status      string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	card, err := h.shareService.UpdateCardByOwner(c.Request.Context(), service.ShareUpdateCardInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		Title:       req.Title,
		Description: req.Description,
		Visibility:  req.Visibility,
		Status:      req.Status,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (h *Handler) shareGetCardAccessCode(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	config, err := h.shareService.GetCardAccessCodeByOwner(c.Request.Context(), user.ID, c.Param("cardId"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

func (h *Handler) shareUpdateCardAccessCode(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Code       string `json:"code"`
		ExpireDays int    `json:"expireDays"`
		UsageLimit int    `json:"usageLimit"`
		Unlimited  bool   `json:"unlimited"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	config, err := h.shareService.UpdateCardAccessCodeByOwner(c.Request.Context(), service.ShareUpdateCardAccessCodeInput{
		OwnerID:    user.ID,
		CardID:     c.Param("cardId"),
		Code:       req.Code,
		ExpireDays: req.ExpireDays,
		UsageLimit: req.UsageLimit,
		Unlimited:  req.Unlimited,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

func (h *Handler) shareDeleteCardAccessCode(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	if err := h.shareService.DeleteCardAccessCodeByOwner(c.Request.Context(), user.ID, c.Param("cardId")); err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareDeleteCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	if err := h.shareService.DeleteCardByOwner(c.Request.Context(), user.ID, c.Param("cardId")); err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) resolveShareSessionUser(c *gin.Context) (*service.ShareSessionUser, error) {
	cookieValue, err := c.Cookie(shareSessionCookieName)
	if err != nil || strings.TrimSpace(cookieValue) == "" {
		return nil, nil
	}

	userID, ok := parseShareSessionToken(cookieValue, h.shareSessionSecret())
	if !ok {
		return nil, nil
	}
	return h.shareService.GetSessionUser(c.Request.Context(), userID)
}

func (h *Handler) requireShareUser(c *gin.Context) (*service.ShareSessionUser, error) {
	value, exists := c.Get(ctxShareUser)
	if !exists || value == nil {
		return nil, errors.New("authentication required")
	}
	user, ok := value.(*service.ShareSessionUser)
	if !ok || user == nil {
		return nil, errors.New("authentication required")
	}
	return user, nil
}

func (h *Handler) currentShareUserID(c *gin.Context) string {
	user, _ := h.resolveShareSessionUser(c)
	if user == nil {
		return ""
	}
	return user.ID
}

func (h *Handler) setShareSessionCookie(c *gin.Context, userID string) {
	token := buildShareSessionToken(userID, h.shareSessionSecret())
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     shareSessionCookieName,
		Value:    token,
		Path:     "/api/share",
		HttpOnly: true,
		Secure:   strings.EqualFold(strings.TrimSpace(h.cfg.Server.Mode), "release"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(shareSessionTTL / time.Second),
		Expires:  time.Now().Add(shareSessionTTL),
	})
}

func (h *Handler) clearShareSessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     shareSessionCookieName,
		Value:    "",
		Path:     "/api/share",
		HttpOnly: true,
		Secure:   strings.EqualFold(strings.TrimSpace(h.cfg.Server.Mode), "release"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func (h *Handler) shareSessionSecret() string {
	secret := strings.TrimSpace(h.cfg.JWT.Secret)
	if secret == "" {
		secret = "change-this-share-session-secret"
	}
	return "share::" + secret
}

func buildShareSessionToken(userID, secret string) string {
	payload := strings.TrimSpace(userID)
	signature := signSharePayload(payload, secret)
	return payload + "." + signature
}

func parseShareSessionToken(token, secret string) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", false
	}

	userID := strings.TrimSpace(parts[0])
	signature := strings.TrimSpace(parts[1])
	if userID == "" || signature == "" {
		return "", false
	}
	if !hmac.Equal([]byte(signature), []byte(signSharePayload(userID, secret))) {
		return "", false
	}
	return userID, true
}

func signSharePayload(payload, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func toAttachmentDisposition(fileName string) string {
	clean := strings.TrimSpace(fileName)
	if clean == "" {
		clean = "download.bin"
	}
	return fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(clean))
}

func inlineDisposition(fileName string) string {
	clean := strings.TrimSpace(fileName)
	if clean == "" {
		clean = "preview.bin"
	}
	return fmt.Sprintf("inline; filename*=UTF-8''%s", url.QueryEscape(clean))
}

func profileAssetContentType(fileName string) string {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(fileName))) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	default:
		return "application/octet-stream"
	}
}

func stringPointerIfNotEmpty(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
