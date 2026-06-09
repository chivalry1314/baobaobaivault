package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
)

func (h *Handler) requireConfiguredShareSuperAdmin(c *gin.Context) (*service.ShareSessionUser, bool) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return nil, false
	}
	if !h.isConfiguredShareSuperAdmin(user) {
		jsonError(c, http.StatusForbidden, service.ErrShareSuperAdminRequired)
		return nil, false
	}
	user.IsConfiguredSuperAdmin = true
	return user, true
}

func (h *Handler) shareSystemListStorageConfigs(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	items, err := h.storageService.ListStorageConfigs(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) shareSystemCreateStorageConfig(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req service.CreateStorageConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.ensureNamespaceOwnerExists(c.Request.Context(), req.OwnerUserID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	cfg, err := h.storageService.CreateStorageConfig(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"item": cfg})
}

func (h *Handler) shareSystemGetStorageConfig(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	item, err := h.storageService.GetStorageConfig(c.Request.Context(), c.Param("id"))
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": item})
}

func (h *Handler) shareSystemUpdateStorageConfig(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req service.UpdateStorageConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.OwnerUserID != nil {
		if err := h.ensureNamespaceOwnerExists(c.Request.Context(), *req.OwnerUserID); err != nil {
			jsonError(c, http.StatusBadRequest, err)
			return
		}
	}

	cfg, err := h.storageService.UpdateStorageConfig(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": cfg})
}

func (h *Handler) shareSystemDeleteStorageConfig(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	if err := h.storageService.DeleteStorageConfig(c.Request.Context(), c.Param("id")); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) shareSystemListNamespaces(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	page, pageSize := parsePage(c)
	req := &service.ListNamespaceRequest{
		Page:     page,
		PageSize: pageSize,
		Status:   strings.TrimSpace(c.Query("status")),
	}

	items, total, err := h.namespaceService.ListNamespaces(c.Request.Context(), req)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"pagination": gin.H{
			"total": total,
			"page": page,
			"pageSize": pageSize,
		},
	})
}

func (h *Handler) shareSystemGetNamespace(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Param("id"))
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace id is required"))
		return
	}

	item, err := h.namespaceService.GetNamespace(c.Request.Context(), namespaceID)
	if err != nil {
		message := strings.ToLower(err.Error())
		if strings.Contains(message, "not found") {
			jsonError(c, http.StatusNotFound, err)
			return
		}
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"item": item})
}

func (h *Handler) shareSystemCreateNamespace(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	var req service.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.ensureNamespaceOwnerExists(c.Request.Context(), req.OwnerUserID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	ns, err := h.namespaceService.CreateNamespace(c.Request.Context(), &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"item": ns})
}

func (h *Handler) shareSystemUpdateNamespace(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Param("id"))
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace id is required"))
		return
	}

	var req service.UpdateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.OwnerUserID != nil {
		if err := h.ensureNamespaceOwnerExists(c.Request.Context(), *req.OwnerUserID); err != nil {
			jsonError(c, http.StatusBadRequest, err)
			return
		}
	}

	ns, err := h.namespaceService.UpdateNamespace(c.Request.Context(), namespaceID, &req)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": ns})
}

func (h *Handler) shareSystemDeleteNamespace(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	namespaceID := strings.TrimSpace(c.Param("id"))
	if namespaceID == "" {
		jsonError(c, http.StatusBadRequest, errors.New("namespace id is required"))
		return
	}

	if err := h.namespaceService.DeleteNamespace(c.Request.Context(), namespaceID); err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
