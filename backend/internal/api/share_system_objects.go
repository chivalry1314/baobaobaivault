package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
)

func (h *Handler) shareSystemUploadObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.PostForm("namespace_id"))
	key := strings.TrimSpace(c.PostForm("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		jsonError(c, http.StatusBadRequest, errors.New("file is required"))
		return
	}
	defer file.Close()

	contentType := strings.TrimSpace(c.PostForm("content_type"))
	if contentType == "" {
		contentType = strings.TrimSpace(header.Header.Get("Content-Type"))
	}

	object, err := h.storageService.PutObject(
		c.Request.Context(),
		namespaceID,
		key,
		file,
		header.Size,
		contentType,
		parseMetadata(c.PostForm("metadata")),
	)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	jsonCreated(c, object)
}

func (h *Handler) shareSystemDownloadObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	reader, object, err := h.storageService.GetObject(c.Request.Context(), namespaceID, key)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	defer reader.Close()

	fileName := object.Name
	if strings.TrimSpace(fileName) == "" {
		fileName = filepath.Base(object.Key)
	}
	if strings.TrimSpace(fileName) == "" {
		fileName = "download.bin"
	}

	contentType := object.ContentType
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(fileName, `"`, "_")))
	if object.Size > 0 {
		c.Header("Content-Length", strconv.FormatInt(object.Size, 10))
	}
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, reader); err != nil {
		c.Error(err)
	}
}

func (h *Handler) shareSystemDeleteObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	if err := h.storageService.DeleteObject(c.Request.Context(), namespaceID, key); err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	h.writeAuditLog(c, "delete", "object", namespaceID+"/"+key, "", "success")
	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) shareSystemListObjects(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req service.ListObjectRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	if req.NamespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}

	items, total, err := h.storageService.ListObjects(c.Request.Context(), req.NamespaceID, req.Prefix, req.Page, req.PageSize)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonPage(c, total, req.Page, req.PageSize, items)
}

func (h *Handler) shareSystemListObjectVersions(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	page, pageSize := parsePage(c)
	items, total, err := h.storageService.ListObjectVersions(c.Request.Context(), namespaceID, key, page, pageSize)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonPage(c, total, page, pageSize, items)
}

func (h *Handler) shareSystemRollbackObjectVersion(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req struct {
		NamespaceID string `json:"namespace_id" binding:"required"`
		Key         string `json:"key" binding:"required"`
		VersionID   string `json:"version_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	object, err := h.storageService.RollbackObjectVersion(c.Request.Context(), req.NamespaceID, req.Key, req.VersionID)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	h.writeAuditLog(c, "rollback", "object_version", req.NamespaceID+"/"+req.Key, "", "success")
	jsonSuccess(c, object)
}

func (h *Handler) shareSystemPresignPutObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ttlSeconds := 300
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 3600 {
			ttlSeconds = v
		}
	}

	result, err := h.storageService.PreparePresignPutObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, result)
}

func (h *Handler) shareSystemCompletePresignPutObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req struct {
		NamespaceID string            `json:"namespace_id" binding:"required"`
		Key         string            `json:"key" binding:"required"`
		VersionID   string            `json:"version_id" binding:"required"`
		ContentType string            `json:"content_type"`
		Metadata    map[string]string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	object, err := h.storageService.FinalizePresignedPut(
		c.Request.Context(),
		req.NamespaceID,
		req.Key,
		req.VersionID,
		req.ContentType,
		req.Metadata,
	)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, object)
}

func (h *Handler) shareSystemPresignGetObject(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Query("namespace_id"))
	key := strings.TrimSpace(c.Query("key"))
	if namespaceID == "" || key == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace_id and key are required"))
		return
	}

	ttlSeconds := 300
	if raw := strings.TrimSpace(c.Query("ttl_seconds")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 3600 {
			ttlSeconds = v
		}
	}

	url, err := h.storageService.PresignGetObject(c.Request.Context(), namespaceID, key, time.Duration(ttlSeconds)*time.Second)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"url": url})
}
