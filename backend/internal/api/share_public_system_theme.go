package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *Handler) shareDiscoverSystemThemes(c *gin.Context) {
	page := 1
	if value := strings.TrimSpace(c.Query("page")); value != "" {
		parsed, parseErr := strconv.Atoi(value)
		if parseErr != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		page = parsed
	}

	size := 24
	if value := strings.TrimSpace(c.Query("size")); value != "" {
		parsed, parseErr := strconv.Atoi(value)
		if parseErr != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		size = parsed
	}

	items, total, err := h.shareService.ListDiscoverSystemThemes(c.Request.Context(), page, size)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	pageSize := size
	if pageSize <= 0 {
		pageSize = 24
	}
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	hasMore := int64(page*pageSize) < total
	if len(items) == 0 {
		hasMore = false
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"pagination": gin.H{
			"page":       page,
			"size":       pageSize,
			"total":      total,
			"totalPages": totalPages,
			"hasMore":    hasMore,
		},
	})
}
