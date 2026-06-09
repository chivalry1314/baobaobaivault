package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/gin-gonic/gin"
)

type shareUnifiedRolePermission struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
}

type shareUnifiedRoleView struct {
	ID          string                       `json:"id"`
	Code        string                       `json:"code"`
	Name        string                       `json:"name"`
	Description string                       `json:"description"`
	IsSystem    bool                         `json:"is_system"`
	Level       int                          `json:"level"`
	CreatedAt   string                       `json:"created_at"`
	UpdatedAt   string                       `json:"updated_at"`
	Permissions []shareUnifiedRolePermission `json:"permissions,omitempty"`
	Namespaces  []any                        `json:"namespaces,omitempty"`
}

func shareUnifiedRolesCatalog() []shareUnifiedRoleView {
	return []shareUnifiedRoleView{
		{
			ID:          model.ShareExternalUserRoleViewer,
			Code:        model.ShareExternalUserRoleViewer,
			Name:        "浏览者",
			Description: "可登录前台、浏览公开内容，不具备创作和系统管理权限。",
			IsSystem:    true,
			Level:       10,
			Permissions: []shareUnifiedRolePermission{
				shareUnifiedPermission("discover", "read", "浏览公开内容"),
				shareUnifiedPermission("profile", "read", "查看个人资料"),
			},
			Namespaces: []any{},
		},
		{
			ID:          model.ShareExternalUserRoleCreator,
			Code:        model.ShareExternalUserRoleCreator,
			Name:        "创作者",
			Description: "可创建、编辑、提交自己的卡片与资源，是 sharefrontend 的默认业务用户角色。",
			IsSystem:    true,
			Level:       50,
			Permissions: []shareUnifiedRolePermission{
				shareUnifiedPermission("discover", "read", "浏览公开内容"),
				shareUnifiedPermission("profile", "read", "查看个人资料"),
				shareUnifiedPermission("cards", "create", "创建卡片"),
				shareUnifiedPermission("cards", "update", "编辑自己的卡片"),
				shareUnifiedPermission("cards", "delete", "删除自己的卡片"),
				shareUnifiedPermission("access_codes", "update", "配置自己的提取码"),
			},
			Namespaces: []any{},
		},
		{
			ID:          model.ShareExternalUserRoleManager,
			Code:        model.ShareExternalUserRoleManager,
			Name:        "管理员",
			Description: "拥有 sharefrontend 的后台与系统管理能力，可管理用户、审核和系统配置。",
			IsSystem:    true,
			Level:       100,
			Permissions: []shareUnifiedRolePermission{
				shareUnifiedPermission("discover", "read", "浏览公开内容"),
				shareUnifiedPermission("profile", "read", "查看个人资料"),
				shareUnifiedPermission("cards", "create", "创建卡片"),
				shareUnifiedPermission("cards", "update", "编辑卡片"),
				shareUnifiedPermission("cards", "delete", "删除卡片"),
				shareUnifiedPermission("cards", "review", "审核卡片"),
				shareUnifiedPermission("users", "manage", "管理用户与角色"),
				shareUnifiedPermission("system", "manage", "管理系统配置"),
				shareUnifiedPermission("storage", "manage", "管理对象存储"),
				shareUnifiedPermission("audit", "read", "查看操作审计"),
			},
			Namespaces: []any{},
		},
	}
}

func shareUnifiedPermission(resource, action, description string) shareUnifiedRolePermission {
	code := resource + ":" + action
	return shareUnifiedRolePermission{
		ID:          code,
		Code:        code,
		Name:        code,
		Description: description,
		Resource:    resource,
		Action:      action,
	}
}

func findShareUnifiedRole(roleID string) (shareUnifiedRoleView, bool) {
	roleID = strings.TrimSpace(roleID)
	for _, item := range shareUnifiedRolesCatalog() {
		if item.ID == roleID || item.Code == roleID {
			return item, true
		}
	}
	return shareUnifiedRoleView{}, false
}

func filterShareUnifiedRoles(keyword, scope string) []shareUnifiedRoleView {
	roles := shareUnifiedRolesCatalog()
	if scope == "custom" {
		return []shareUnifiedRoleView{}
	}
	if scope != "" && scope != "all" && scope != "system" {
		return []shareUnifiedRoleView{}
	}
	if keyword == "" {
		return roles
	}

	keyword = strings.ToLower(strings.TrimSpace(keyword))
	filtered := make([]shareUnifiedRoleView, 0, len(roles))
	for _, item := range roles {
		if strings.Contains(strings.ToLower(item.Name), keyword) ||
			strings.Contains(strings.ToLower(item.Code), keyword) ||
			strings.Contains(strings.ToLower(item.Description), keyword) {
			filtered = append(filtered, item)
			continue
		}

		matched := false
		for _, permission := range item.Permissions {
			if strings.Contains(strings.ToLower(permission.Code), keyword) ||
				strings.Contains(strings.ToLower(permission.Description), keyword) {
				matched = true
				break
			}
		}
		if matched {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func paginateShareUnifiedRoles(items []shareUnifiedRoleView, page, pageSize int) []shareUnifiedRoleView {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	start := (page - 1) * pageSize
	if start >= len(items) {
		return []shareUnifiedRoleView{}
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

func (h *Handler) shareSystemListPermissions(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	items := make([]shareUnifiedRolePermission, 0, 16)
	for _, role := range shareUnifiedRolesCatalog() {
		items = append(items, role.Permissions...)
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) shareSystemListRoles(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	page, pageSize := parsePage(c)
	keyword := strings.TrimSpace(c.Query("keyword"))
	scope := strings.TrimSpace(c.Query("scope"))
	items := filterShareUnifiedRoles(keyword, scope)
	total := len(items)
	paged := paginateShareUnifiedRoles(items, page, pageSize)

	c.JSON(http.StatusOK, gin.H{
		"items": paged,
		"pagination": gin.H{
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (h *Handler) shareSystemGetRole(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}

	roleID := strings.TrimSpace(c.Param("id"))
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role id is required"})
		return
	}

	item, ok := findShareUnifiedRole(roleID)
	if !ok {
		jsonError(c, http.StatusNotFound, errors.New("role not found"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": item})
}

func (h *Handler) shareSystemCreateRole(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}
	jsonError(c, http.StatusBadRequest, errors.New("system role can not be created"))
}

func (h *Handler) shareSystemUpdateRole(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}
	jsonError(c, http.StatusBadRequest, errors.New("system role can not be modified"))
}

func (h *Handler) shareSystemDeleteRole(c *gin.Context) {
	if _, ok := h.requireConfiguredShareSuperAdmin(c); !ok {
		return
	}
	jsonError(c, http.StatusBadRequest, errors.New("system role can not be deleted"))
}
