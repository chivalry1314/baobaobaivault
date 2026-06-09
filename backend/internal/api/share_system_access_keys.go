package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	authpkg "github.com/baobaobai/baobaobaivault/pkg/auth"
	"github.com/gin-gonic/gin"
)

func (h *Handler) shareSystemListAccessKeys(c *gin.Context) {
	shareUser, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	items := make([]*model.AKSK, 0, 16)
	if err := h.db.WithContext(c.Request.Context()).
		Where("share_external_user_id = ?", shareUser.ID).
		Order("created_at DESC").
		Find(&items).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"owner": gin.H{
			"id":       shareUser.ID,
			"email":    shareUser.Email,
			"username": shareUser.Username,
			"nickname": shareUser.Nickname,
		},
	})
}

func (h *Handler) shareSystemCreateAccessKey(c *gin.Context) {
	shareUser, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	var req struct {
		Description  string `json:"description"`
		ExpiresInDays int   `json:"expires_in_days"`
	}
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
		UserID:              shareUser.ID,
		ShareExternalUserID: &shareUser.ID,
		AccessKey:           accessKey,
		SecretKey:           secretKey,
		Description:         strings.TrimSpace(req.Description),
		Status:              model.AKSKStatusActive,
		ExpiresAt:           expiresAt,
	}
	if err := h.db.WithContext(c.Request.Context()).Create(record).Error; err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"item": gin.H{
			"id":          record.ID,
			"access_key":  record.AccessKey,
			"secret_key":  record.SecretKey,
			"description": record.Description,
			"status":      record.Status,
			"expires_at":  record.ExpiresAt,
			"created_at":  record.CreatedAt,
		},
	})
}

func (h *Handler) shareSystemRevokeAccessKey(c *gin.Context) {
	shareUser, ok := h.requireConfiguredShareSuperAdmin(c)
	if !ok {
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		jsonError(c, http.StatusBadRequest, errors.New("id is required"))
		return
	}

	result := h.db.WithContext(c.Request.Context()).
		Model(&model.AKSK{}).
		Where("id = ? AND share_external_user_id = ?", id, shareUser.ID).
		Update("status", model.AKSKStatusRevoked)
	if result.Error != nil {
		jsonError(c, http.StatusInternalServerError, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		jsonError(c, http.StatusNotFound, errors.New("aksk not found"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
