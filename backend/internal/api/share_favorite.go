package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
)

func (h *Handler) shareFavoriteCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	cardID := strings.TrimSpace(c.Param("cardId"))
	if cardID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("card id is required"))
		return
	}

	if err := h.shareService.FavoriteCard(c.Request.Context(), user.ID, cardID); err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusUnauthorized
		}
		jsonError(c, status, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareUnfavoriteCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	cardID := strings.TrimSpace(c.Param("cardId"))
	if cardID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("card id is required"))
		return
	}

	if err := h.shareService.UnfavoriteCard(c.Request.Context(), user.ID, cardID); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrShareFavoriteNotFound) {
			status = http.StatusNotFound
		}
		jsonError(c, status, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareMyFavorites(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

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

	cards, total, err := h.shareService.ListFavoritedCards(c.Request.Context(), user.ID, page, size)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrShareUserNotFound) {
			status = http.StatusUnauthorized
		}
		jsonError(c, status, err)
		return
	}

	pageSize := size
	if pageSize <= 0 {
		pageSize = 24
	}
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	hasMore := int64(page*pageSize) < total
	if len(cards) == 0 {
		hasMore = false
	}

	c.JSON(http.StatusOK, gin.H{
		"cards": cards,
		"pagination": gin.H{
			"page":       page,
			"size":       pageSize,
			"total":      total,
			"totalPages": totalPages,
			"hasMore":    hasMore,
		},
	})
}
