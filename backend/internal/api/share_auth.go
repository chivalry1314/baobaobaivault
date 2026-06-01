package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
	"time"
)

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
