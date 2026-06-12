package api

import (
	"errors"
	"fmt"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
)

func (h *Handler) shareDiscoverCards(c *gin.Context) {
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

	viewerUserID := h.currentShareUserID(c)
	cards, total, err := h.shareService.ListDiscoverCards(c.Request.Context(), page, size, viewerUserID)
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

func (h *Handler) shareCardAssetPreview(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, asset, err := h.shareService.CanAccessCardFile(c.Request.Context(), c.Param("cardId"), viewerUserID)
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
	slot := strings.TrimSpace(c.Param("slot"))
	if slot != "" {
		asset, err = h.shareService.GetCardAssetForPreview(c.Request.Context(), card.ID, slot)
		if err != nil {
			status := http.StatusInternalServerError
			switch {
			case errors.Is(err, service.ErrShareCardNotFound):
				status = http.StatusNotFound
			case errors.Is(err, service.ErrShareInvalidCardSlot):
				status = http.StatusBadRequest
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
	}
	assetMimeType := resolveStoredMimeType(asset.MimeType, asset.OriginalFileName)
	if !strings.HasPrefix(assetMimeType, "image/") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "preview only supports image cards"})
		return
	}

	file, size, err := h.shareService.OpenCardFile(c.Request.Context(), card, asset)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", assetMimeType)
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Content-Disposition", inlineDisposition(asset.OriginalFileName))
	c.Header("Cache-Control", sharePreviewCacheControl(card))
	c.DataFromReader(http.StatusOK, size, assetMimeType, file, map[string]string{
		"Content-Disposition": inlineDisposition(asset.OriginalFileName),
		"Cache-Control":       sharePreviewCacheControl(card),
	})
}

func (h *Handler) shareCardCoverPreview(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, err := h.shareService.CanAccessCardCover(c.Request.Context(), c.Param("cardId"), viewerUserID)
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

	mimeType := resolveStoredMimeType(card.MimeType, card.OriginalFileName)
	if !strings.HasPrefix(mimeType, "image/") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "preview only supports image covers"})
		return
	}

	file, size, err := h.shareService.OpenCardCoverFile(c.Request.Context(), card)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", mimeType)
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Content-Disposition", inlineDisposition(card.OriginalFileName))
	c.Header("Cache-Control", sharePreviewCacheControl(card))
	c.DataFromReader(http.StatusOK, size, mimeType, file, map[string]string{
		"Content-Disposition": inlineDisposition(card.OriginalFileName),
		"Cache-Control":       sharePreviewCacheControl(card),
	})
}

func (h *Handler) shareCardCoverDownload(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, err := h.shareService.CanAccessCardCover(c.Request.Context(), c.Param("cardId"), viewerUserID)
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

	mimeType := resolveStoredMimeType(card.MimeType, card.OriginalFileName)

	file, size, err := h.shareService.OpenCardCoverFile(c.Request.Context(), card)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", mimeType)
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Content-Disposition", toAttachmentDisposition(card.OriginalFileName))
	c.Header("Cache-Control", "no-store")
	c.DataFromReader(http.StatusOK, size, mimeType, file, map[string]string{
		"Content-Disposition": toAttachmentDisposition(card.OriginalFileName),
		"Cache-Control":       "no-store",
	})
}

func (h *Handler) shareCardAssetDownload(c *gin.Context) {
	viewerUserID := h.currentShareUserID(c)
	card, asset, consumeAccessCode, err := h.shareService.CanDownloadCardAsset(
		c.Request.Context(),
		c.Param("cardId"),
		viewerUserID,
		c.Query("code"),
		c.Param("slot"),
	)
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

	file, size, err := h.shareService.OpenCardFile(c.Request.Context(), card, asset)
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

	c.Header("Content-Type", asset.MimeType)
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Content-Disposition", toAttachmentDisposition(asset.OriginalFileName))
	c.Header("Cache-Control", "no-store")
	c.DataFromReader(http.StatusOK, size, asset.MimeType, file, map[string]string{
		"Content-Disposition": toAttachmentDisposition(asset.OriginalFileName),
		"Cache-Control":       "no-store",
	})
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

func resolveStoredMimeType(mimeType, fileName string) string {
	value := strings.TrimSpace(strings.ToLower(mimeType))
	if value != "" && value != "application/octet-stream" {
		return value
	}

	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	if ext != "" {
		if guessed := strings.TrimSpace(strings.ToLower(mime.TypeByExtension(ext))); guessed != "" {
			return guessed
		}
	}

	if value != "" {
		return value
	}
	return "application/octet-stream"
}

func stringPointerIfNotEmpty(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func sharePreviewCacheControl(card *model.SharePlatformCard) string {
	if card == nil {
		return "no-store"
	}
	if card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved {
		return "public, max-age=300, stale-while-revalidate=86400"
	}
	return "private, no-store"
}
