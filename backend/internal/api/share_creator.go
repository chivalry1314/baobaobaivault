package api

import (
	"encoding/json"
	"errors"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"strings"
)

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
	dashboard.User.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(&dashboard.User)
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
	dashboard.User.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(&dashboard.User)
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

	updated.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(updated)
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

func (h *Handler) shareDeleteOwnAccount(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.shareService.DeleteOwnExternalUser(c.Request.Context(), service.ShareSelfDeleteInput{
		UserID:      user.ID,
		OldPassword: req.OldPassword,
	}); err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareDeleteAuthFailed):
			status = http.StatusUnauthorized
		case errors.Is(err, service.ErrShareProtectedSuperAdmin):
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.clearShareSessionCookie(c)
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

	var coverFile io.ReadCloser
	coverFileName := ""
	coverMimeType := ""
	coverReader := io.Reader(nil)
	if optionalCoverFile, optionalCoverHeader, optionalCoverErr := c.Request.FormFile("cover"); optionalCoverErr == nil {
		coverFile = optionalCoverFile
		coverFileName = optionalCoverHeader.Filename
		coverMimeType = optionalCoverHeader.Header.Get("Content-Type")
		coverReader = optionalCoverFile
	} else if !errors.Is(optionalCoverErr, http.ErrMissingFile) {
		var maxBytesErr *http.MaxBytesError
		if errors.As(optionalCoverErr, &maxBytesErr) || strings.Contains(strings.ToLower(optionalCoverErr.Error()), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": service.ErrShareFileTooLarge.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if coverFile != nil {
		defer coverFile.Close()
	}

	card, err := h.shareService.CreateCard(c.Request.Context(), service.ShareCreateCardInput{
		CreatorID:     user.ID,
		Title:         c.PostForm("title"),
		Description:   c.PostForm("description"),
		Tags:          parseShareCardTagsPayload(c.PostForm("tags")),
		Visibility:    c.PostForm("visibility"),
		Status:        c.PostForm("status"),
		AccessMode:    c.PostForm("accessMode"),
		FileName:      header.Filename,
		MimeType:      header.Header.Get("Content-Type"),
		FileReader:    file,
		CoverFileName: coverFileName,
		CoverMimeType: coverMimeType,
		CoverReader:   coverReader,
		MaxFileSize:   maxUploadSize,
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

func (h *Handler) shareCreateCardBundle(c *gin.Context) {
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

	payloadRaw := strings.TrimSpace(c.PostForm("payload"))
	if payloadRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	var payload struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Tags        []string `json:"tags"`
		Visibility  string `json:"visibility"`
		Status      string `json:"status"`
		AccessMode  string `json:"accessMode"`
		Items       []struct {
			Slot      string `json:"slot"`
			FileField string `json:"fileField"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	assetInputs := make([]service.ShareCreateCardAssetInput, 0, len(payload.Items))
	closers := make([]io.Closer, 0, len(payload.Items))
	coverFileName := ""
	coverMimeType := ""
	coverReader := io.Reader(nil)
	defer func() {
		for _, closer := range closers {
			_ = closer.Close()
		}
	}()

	if optionalCoverFile, optionalCoverHeader, optionalCoverErr := c.Request.FormFile("cover"); optionalCoverErr == nil {
		coverFileName = optionalCoverHeader.Filename
		coverMimeType = optionalCoverHeader.Header.Get("Content-Type")
		coverReader = optionalCoverFile
		closers = append(closers, optionalCoverFile)
	} else if !errors.Is(optionalCoverErr, http.ErrMissingFile) {
		var maxBytesErr *http.MaxBytesError
		if errors.As(optionalCoverErr, &maxBytesErr) || strings.Contains(strings.ToLower(optionalCoverErr.Error()), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": service.ErrShareFileTooLarge.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	for _, item := range payload.Items {
		field := strings.TrimSpace(item.FileField)
		if field == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrShareFileRequired.Error()})
			return
		}

		file, header, err := c.Request.FormFile(field)
		if err != nil {
			var maxBytesErr *http.MaxBytesError
			if errors.As(err, &maxBytesErr) || strings.Contains(strings.ToLower(err.Error()), "request body too large") {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": service.ErrShareFileTooLarge.Error()})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrShareFileRequired.Error()})
			return
		}

		closers = append(closers, file)
		assetInputs = append(assetInputs, service.ShareCreateCardAssetInput{
			Slot:       item.Slot,
			FileName:   header.Filename,
			MimeType:   header.Header.Get("Content-Type"),
			FileReader: file,
		})
	}

	card, err := h.shareService.CreateCardBundle(c.Request.Context(), service.ShareCreateCardBundleInput{
		CreatorID:     user.ID,
		Title:         payload.Title,
		Description:   payload.Description,
		Tags:          payload.Tags,
		Visibility:    payload.Visibility,
		Status:        payload.Status,
		AccessMode:    payload.AccessMode,
		Assets:        assetInputs,
		CoverFileName: coverFileName,
		CoverMimeType: coverMimeType,
		CoverReader:   coverReader,
		MaxFileSize:   maxUploadSize,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"card": card})
}

func (h *Handler) shareCreateCardBundlePresign(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Title            string `json:"title" binding:"required"`
		Description      string `json:"description"`
		Tags             []string `json:"tags"`
		Visibility       string `json:"visibility" binding:"required"`
		Status           string `json:"status"`
		AccessMode       string `json:"access_mode" binding:"required"`
		CoverContentType string `json:"cover_content_type"`
		CoverSize        int64  `json:"cover_size"`
		Assets           []struct {
			Slot        string `json:"slot" binding:"required"`
			ContentType string `json:"content_type"`
			Size        int64  `json:"size"`
		} `json:"assets" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	assets := make([]service.SharePrepareCardBundleAssetInput, 0, len(req.Assets))
	for _, a := range req.Assets {
		assets = append(assets, service.SharePrepareCardBundleAssetInput{
			Slot:        a.Slot,
			ContentType: a.ContentType,
			Size:        a.Size,
		})
	}

	result, err := h.shareService.PrepareCardBundleUpload(c.Request.Context(), service.SharePrepareCardBundleUploadInput{
		CreatorID:        user.ID,
		Title:            req.Title,
		Description:      req.Description,
		Tags:             req.Tags,
		Visibility:       req.Visibility,
		Status:           req.Status,
		AccessMode:       req.AccessMode,
		CoverContentType: req.CoverContentType,
		CoverSize:        req.CoverSize,
		Assets:           assets,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardTitleRequired),
			errors.Is(err, service.ErrShareInvalidVisibility),
			errors.Is(err, service.ErrShareInvalidAccessMode),
			errors.Is(err, service.ErrShareInvalidCardStatus),
			errors.Is(err, service.ErrShareInvalidCardSlot),
			errors.Is(err, service.ErrShareFileRequired):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) shareCreateCardBundleComplete(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	maxUploadSize := h.cfg.Storage.MaxFileSize
	if maxUploadSize <= 0 {
		maxUploadSize = shareFallbackMaxUploadSize
	}

	var req struct {
		CardID      string `json:"card_id" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Tags        []string `json:"tags"`
		Visibility  string `json:"visibility" binding:"required"`
		Status      string `json:"status"`
		AccessMode  string `json:"access_mode" binding:"required"`
		Cover       *struct {
			ObjectKey   string `json:"object_key" binding:"required"`
			VersionID   string `json:"version_id" binding:"required"`
			ETag        string `json:"etag"`
			Size        int64  `json:"size" binding:"required"`
			FileName    string `json:"file_name" binding:"required"`
			MimeType    string `json:"mime_type"`
			NamespaceID string `json:"namespace_id"`
		} `json:"cover"`
		Assets []struct {
			Slot string `json:"slot" binding:"required"`
			ObjectKey   string `json:"object_key" binding:"required"`
			VersionID   string `json:"version_id" binding:"required"`
			ETag        string `json:"etag"`
			Size        int64  `json:"size" binding:"required"`
			FileName    string `json:"file_name" binding:"required"`
			MimeType    string `json:"mime_type"`
			NamespaceID string `json:"namespace_id"`
		} `json:"assets" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	var cover *service.ShareUploadedMediaInfo
	if req.Cover != nil {
		cover = &service.ShareUploadedMediaInfo{
			ObjectKey:   req.Cover.ObjectKey,
			VersionID:   req.Cover.VersionID,
			ETag:        req.Cover.ETag,
			Size:        req.Cover.Size,
			FileName:    req.Cover.FileName,
			MimeType:    req.Cover.MimeType,
			NamespaceID: req.Cover.NamespaceID,
		}
	}

	assets := make([]service.ShareUploadedAssetInfo, 0, len(req.Assets))
	for _, a := range req.Assets {
		assets = append(assets, service.ShareUploadedAssetInfo{
			Slot: a.Slot,
			ShareUploadedMediaInfo: service.ShareUploadedMediaInfo{
				ObjectKey:   a.ObjectKey,
				VersionID:   a.VersionID,
				ETag:        a.ETag,
				Size:        a.Size,
				FileName:    a.FileName,
				MimeType:    a.MimeType,
				NamespaceID: a.NamespaceID,
			},
		})
	}

	card, err := h.shareService.CreateCardBundleFromPresignedUpload(c.Request.Context(), service.ShareCreateCardBundleFromPresignedInput{
		CreatorID:   user.ID,
		CardID:      req.CardID,
		Title:       req.Title,
		Description: req.Description,
		Tags:        req.Tags,
		Visibility:  req.Visibility,
		Status:      req.Status,
		AccessMode:  req.AccessMode,
		Cover:       cover,
		Assets:      assets,
		MaxFileSize: maxUploadSize,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
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
		Tags        []string `json:"tags"`
		Visibility  string `json:"visibility"`
		Status      string `json:"status"`
		AccessMode  string `json:"accessMode"`
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
		Tags:        req.Tags,
		Visibility:  req.Visibility,
		Status:      req.Status,
		AccessMode:  req.AccessMode,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrSharePaidAccessRequired):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (h *Handler) shareReplaceCardAsset(c *gin.Context) {
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

	detail, err := h.shareService.ReplaceCardAssetByOwner(c.Request.Context(), service.ShareUpdateCardAssetInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		Slot:        c.Param("slot"),
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
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
}

func (h *Handler) shareReplaceCardCover(c *gin.Context) {
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

	detail, err := h.shareService.ReplaceCardCoverByOwner(
		c.Request.Context(),
		user.ID,
		c.Param("cardId"),
		header.Filename,
		header.Header.Get("Content-Type"),
		file,
		maxUploadSize,
	)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
}

func (h *Handler) shareDeleteCardAsset(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	detail, err := h.shareService.DeleteCardAssetByOwner(c.Request.Context(), user.ID, c.Param("cardId"), c.Param("slot"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
}

func (h *Handler) shareDeleteCardCover(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	detail, err := h.shareService.DeleteCardCoverByOwner(c.Request.Context(), user.ID, c.Param("cardId"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
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

func parseShareCardTagsPayload(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}
	var items []string
	if strings.HasPrefix(trimmed, "[") {
		if err := json.Unmarshal([]byte(trimmed), &items); err == nil {
			return normalizeShareCardTagsPayload(items)
		}
	}
	return normalizeShareCardTagsPayload(strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == '，' || r == ';' || r == '；'
	}))
}

func normalizeShareCardTagsPayload(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, raw := range tags {
		tag := strings.TrimSpace(raw)
		if tag == "" {
			continue
		}
		tag = strings.Join(strings.Fields(tag), " ")
		if tag == "" {
			continue
		}
		if len(tag) > 32 {
			tag = strings.TrimSpace(tag[:32])
		}
		key := strings.ToLower(tag)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, tag)
		if len(result) >= 12 {
			break
		}
	}
	if len(result) == 0 {
		return []string{}
	}
	return result
}

func (h *Handler) shareUpdateCardAccessCode(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		AccessMode string `json:"accessMode"`
		Visibility string `json:"visibility"`
		Status     string `json:"status"`
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
		AccessMode: req.AccessMode,
		Visibility: req.Visibility,
		Status:     req.Status,
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

func (h *Handler) shareReplaceCardCoverPresign(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		ContentType string `json:"content_type" binding:"required"`
		Size        int64  `json:"size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := h.shareService.PrepareCardCoverReplaceUpload(c.Request.Context(), service.ShareUpdateCardMediaPresignInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		ContentType: req.ContentType,
		Size:        req.Size,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) shareReplaceCardCoverComplete(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	maxUploadSize := h.cfg.Storage.MaxFileSize
	if maxUploadSize <= 0 {
		maxUploadSize = shareFallbackMaxUploadSize
	}

	var req struct {
		ObjectKey   string `json:"object_key" binding:"required"`
		VersionID   string `json:"version_id" binding:"required"`
		ETag        string `json:"etag"`
		Size        int64  `json:"size" binding:"required"`
		FileName    string `json:"file_name" binding:"required"`
		MimeType    string `json:"mime_type"`
		NamespaceID string `json:"namespace_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	detail, err := h.shareService.ReplaceCardCoverFromPresignedUpload(c.Request.Context(), service.ShareUpdateCardCoverFromPresignedInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		MaxFileSize: maxUploadSize,
		Cover: &service.ShareUploadedMediaInfo{
			ObjectKey:   req.ObjectKey,
			VersionID:   req.VersionID,
			ETag:        req.ETag,
			Size:        req.Size,
			FileName:    req.FileName,
			MimeType:    req.MimeType,
			NamespaceID: req.NamespaceID,
		},
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
}

func (h *Handler) shareReplaceCardAssetPresign(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		ContentType string `json:"content_type"`
		Size        int64  `json:"size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := h.shareService.PrepareCardAssetReplaceUpload(c.Request.Context(), service.ShareUpdateCardMediaPresignInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		Slot:        c.Param("slot"),
		ContentType: req.ContentType,
		Size:        req.Size,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareInvalidCardSlot):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) shareReplaceCardAssetComplete(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	maxUploadSize := h.cfg.Storage.MaxFileSize
	if maxUploadSize <= 0 {
		maxUploadSize = shareFallbackMaxUploadSize
	}

	var req struct {
		ObjectKey   string `json:"object_key" binding:"required"`
		VersionID   string `json:"version_id" binding:"required"`
		ETag        string `json:"etag"`
		Size        int64  `json:"size" binding:"required"`
		FileName    string `json:"file_name" binding:"required"`
		MimeType    string `json:"mime_type"`
		NamespaceID string `json:"namespace_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	detail, err := h.shareService.ReplaceCardAssetFromPresignedUpload(c.Request.Context(), service.ShareUpdateCardAssetFromPresignedInput{
		OwnerID:     user.ID,
		CardID:      c.Param("cardId"),
		Slot:        c.Param("slot"),
		MaxFileSize: maxUploadSize,
		Asset: &service.ShareUploadedMediaInfo{
			ObjectKey:   req.ObjectKey,
			VersionID:   req.VersionID,
			ETag:        req.ETag,
			Size:        req.Size,
			FileName:    req.FileName,
			MimeType:    req.MimeType,
			NamespaceID: req.NamespaceID,
		},
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareFileTooLarge):
			status = http.StatusRequestEntityTooLarge
		case errors.Is(err, service.ErrShareSaveFileFailed):
			status = http.StatusInternalServerError
		case errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareCardForbidden),
			errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": detail.Card, "assets": detail.Assets})
}

func (h *Handler) shareSubmitCardReview(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	card, err := h.shareService.SubmitCardForReview(c.Request.Context(), user.ID, c.Param("cardId"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound),
			errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareCardForbidden):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}
