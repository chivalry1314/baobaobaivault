package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// writeAuditLog 记录一条管理操作审计日志；错误仅内部记录，不中断请求
func (h *Handler) writeAuditLog(c *gin.Context, action, resource, resourceID, detail, status string) {
	user, _ := c.Get(ctxShareUser)
	shareUser, _ := user.(*model.ShareExternalUser)
	var userID *string
	if shareUser != nil {
		userID = &shareUser.ID
	}

	ip := c.ClientIP()
	ua := c.Request.UserAgent()

	log := &model.AuditLog{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Detail:     detail,
		IPAddress:  ip,
		UserAgent:  ua,
		Status:     status,
	}
	if err := h.db.WithContext(c.Request.Context()).Create(log).Error; err != nil {
		h.logger.Error("failed to write audit log", zap.Error(err))
	}
}

func (h *Handler) shareSystemListAuditLogs(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	page, pageSize := parsePage(c)

	query := h.db.WithContext(c.Request.Context()).Model(&model.AuditLog{})
	if action := strings.TrimSpace(c.Query("action")); action != "" {
		query = query.Where("action = ?", strings.ToLower(action))
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
	if rawFrom := strings.TrimSpace(c.Query("from")); rawFrom != "" {
		from, err := parseAuditTime(rawFrom, false)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid from: %w", err))
			return
		}
		query = query.Where("created_at >= ?", from)
	}
	if rawTo := strings.TrimSpace(c.Query("to")); rawTo != "" {
		to, err := parseAuditTime(rawTo, true)
		if err != nil {
			jsonError(c, http.StatusBadRequest, fmt.Errorf("invalid to: %w", err))
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
