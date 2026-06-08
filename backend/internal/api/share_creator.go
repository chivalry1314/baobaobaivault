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
