package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
	"net/mail"
	"net/http"
	"strings"
	"time"
)

const shareSMTPTestCooldown = 60 * time.Second

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

	result, err := h.shareService.RegisterExternalUser(c.Request.Context(), req.Email, req.Nickname, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareEmailExists):
			status = http.StatusConflict
		case errors.Is(err, service.ErrShareVerificationTooSoon):
			status = http.StatusTooManyRequests
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	if result.User != nil {
		h.setShareSessionCookie(c, result.User.ID)
	}

	c.JSON(http.StatusCreated, gin.H{
		"ok":                   true,
		"user":                 result.User,
		"verificationRequired": result.VerificationRequired,
		"email":                result.Email,
		"expiresIn":            result.ExpiresInSeconds,
	})
}

func (h *Handler) shareRegisterVerify(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.shareService.VerifyExternalUserRegistration(c.Request.Context(), req.Email, req.Code)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareEmailExists):
			status = http.StatusConflict
		case errors.Is(err, service.ErrShareVerificationTooMany):
			status = http.StatusTooManyRequests
		case errors.Is(err, service.ErrShareVerificationRequired),
			errors.Is(err, service.ErrShareEmailNotVerified):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.setShareSessionCookie(c, user.ID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "user": user})
}

func (h *Handler) shareRegisterResend(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	expiresIn, err := h.shareService.ResendExternalUserRegistrationVerification(c.Request.Context(), req.Email)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareVerificationTooSoon):
			status = http.StatusTooManyRequests
		case errors.Is(err, service.ErrShareVerificationRequired):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"email":     strings.TrimSpace(req.Email),
		"expiresIn": expiresIn,
	})
}

func (h *Handler) shareAuthConfig(c *gin.Context) {
	cfg := h.shareService.GetShareAuthConfig()
	c.JSON(http.StatusOK, gin.H{"ok": true, "config": cfg})
}

func (h *Handler) shareEmailHealth(c *gin.Context) {
	health := h.shareService.GetShareEmailHealth()
	c.JSON(http.StatusOK, gin.H{"ok": true, "health": health})
}

func (h *Handler) shareSendSMTPTest(c *gin.Context) {
	var req struct {
		TargetEmail string `json:"targetEmail"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.requireShareUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	if user.Role != "manager" {
		c.JSON(http.StatusForbidden, gin.H{"error": service.ErrShareForbiddenRole.Error()})
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
		"ok":         true,
		"targetEmail": targetEmail,
	})
}

func (h *Handler) shareSMTPTestRetryAfter(userID string) (time.Duration, bool) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, false
	}

	now := time.Now().UTC()
	h.shareSMTPTestMu.Lock()
	defer h.shareSMTPTestMu.Unlock()

	lastSentAt, ok := h.shareSMTPTestAt[userID]
	if !ok {
		return 0, false
	}
	retryAfter := shareSMTPTestCooldown - now.Sub(lastSentAt)
	if retryAfter <= 0 {
		delete(h.shareSMTPTestAt, userID)
		return 0, false
	}
	return retryAfter, true
}

func (h *Handler) markShareSMTPTestSent(userID string) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return
	}

	h.shareSMTPTestMu.Lock()
	h.shareSMTPTestAt[userID] = time.Now().UTC()
	h.shareSMTPTestMu.Unlock()
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
		case errors.Is(err, service.ErrShareVerificationRequired), errors.Is(err, service.ErrShareEmailNotVerified):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	user.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(user)
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
		switch {
		case errors.Is(err, service.ErrShareEmailNotVerified):
			status = http.StatusForbidden
		case !errors.Is(err, service.ErrShareAuthFailed):
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	user.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(user)
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
	user.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(user)
	c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": user})
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
	user.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(user)
	return user, nil
}

func (h *Handler) currentShareUserID(c *gin.Context) string {
	user, _ := h.resolveShareSessionUser(c)
	if user == nil {
		return ""
	}
	return user.ID
}

func (h *Handler) isConfiguredShareSuperAdmin(user *service.ShareSessionUser) bool {
	if user == nil {
		return false
	}
	configuredEmail := strings.ToLower(strings.TrimSpace(h.cfg.Server.AdminEmail))
	currentEmail := strings.ToLower(strings.TrimSpace(user.Email))
	if configuredEmail == "" || currentEmail == "" {
		return false
	}
	return configuredEmail == currentEmail
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
