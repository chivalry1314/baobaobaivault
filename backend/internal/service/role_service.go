package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// RoleService manages roles and permission bindings.
type RoleService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewRoleService(db *gorm.DB, logger *zap.Logger) *RoleService {
	return &RoleService{db: db, logger: logger}
}

func (s *RoleService) EnsureDefaultAdminRole(ctx context.Context) (*model.Role, error) {
	var role model.Role
	err := s.db.WithContext(ctx).
		Preload("Permissions").
		First(&role, "code = ?", model.RoleCodeAdmin).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		role = model.Role{
			Code:        model.RoleCodeAdmin,
			Name:        "Administrator",
			Description: "Full control over platform resources",
			IsSystem:    true,
			Level:       100,
		}
		if err := s.db.WithContext(ctx).Create(&role).Error; err != nil {
			return nil, err
		}
	}

	resourceActions := map[string][]model.PermissionAction{
		"user":      {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionAdmin},
		"namespace": {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionAdmin},
		"storage":   {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionAdmin},
		"object":    {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionShare, model.ActionAdmin},
		"audit":     {model.ActionRead, model.ActionList, model.ActionAdmin},
	}
	permissionIDs := make([]string, 0, 64)
	for resource, actions := range resourceActions {
		for _, action := range actions {
			code := fmt.Sprintf("%s:%s", resource, string(action))
			var permission model.Permission
			err := s.db.WithContext(ctx).First(&permission, "code = ?", code).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
			if errors.Is(err, gorm.ErrRecordNotFound) {
				permission = model.Permission{
					Code:        code,
					Name:        code,
					Description: fmt.Sprintf("%s %s permission", resource, action),
					Resource:    resource,
					Action:      action,
				}
				if err := s.db.WithContext(ctx).Create(&permission).Error; err != nil {
					return nil, err
				}
			}
			permissionIDs = append(permissionIDs, permission.ID)
		}
	}

	permissions := make([]model.Permission, 0, len(permissionIDs))
	if err := s.db.WithContext(ctx).Find(&permissions, "id IN ?", permissionIDs).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&role).Association("Permissions").Replace(permissions); err != nil {
		return nil, err
	}

	return s.GetRole(ctx, role.ID)
}

func (s *RoleService) ListRoles(ctx context.Context) ([]*model.Role, error) {
	items := make([]*model.Role, 0, 16)
	err := s.db.WithContext(ctx).
		Preload("Permissions").
		Preload("Namespaces").
		Order("is_system DESC, level DESC, created_at ASC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	return items, nil
}

func (s *RoleService) ListPermissions(ctx context.Context) ([]*model.Permission, error) {
	items := make([]*model.Permission, 0, 32)
	if err := s.db.WithContext(ctx).Order("resource ASC, action ASC, code ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("failed to list permissions: %w", err)
	}
	return items, nil
}

func (s *RoleService) CreateRole(ctx context.Context, req *CreateRoleRequest) (*model.Role, error) {
	if req == nil {
		return nil, errors.New("invalid request")
	}
	code := strings.TrimSpace(req.Code)
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return nil, errors.New("code and name are required")
	}
	if strings.EqualFold(code, model.RoleCodeAdmin) {
		return nil, errors.New("admin role can not be created manually")
	}

	var existing int64
	if err := s.db.WithContext(ctx).Model(&model.Role{}).
		Where("code = ?", code).
		Count(&existing).Error; err != nil {
		return nil, fmt.Errorf("failed to check role code: %w", err)
	}
	if existing > 0 {
		return nil, errors.New("role code already exists")
	}

	role := &model.Role{
		Code:        code,
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		IsSystem:    false,
		Level:       req.Level,
	}

	perms, err := s.findPermissionsByIDs(ctx, req.PermissionIDs)
	if err != nil {
		return nil, err
	}
	namespaces, err := s.findNamespacesByIDs(ctx, req.NamespaceIDs)
	if err != nil {
		return nil, err
	}

	tx := s.db.WithContext(ctx).Begin()
	if err := tx.Create(role).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create role: %w", err)
	}
	if err := tx.Model(role).Association("Permissions").Replace(perms); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to bind role permissions: %w", err)
	}
	if err := tx.Model(role).Association("Namespaces").Replace(namespaces); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to bind role namespaces: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit create role transaction: %w", err)
	}

	s.logger.Info("Role created", zap.String("role_id", role.ID), zap.String("code", role.Code))
	return s.GetRole(ctx, role.ID)
}

func (s *RoleService) GetRole(ctx context.Context, roleID string) (*model.Role, error) {
	var role model.Role
	err := s.db.WithContext(ctx).
		Preload("Permissions").
		Preload("Namespaces").
		Where("id = ?", roleID).
		First(&role).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("role not found")
		}
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	return &role, nil
}

func (s *RoleService) UpdateRole(ctx context.Context, roleID string, req *UpdateRoleRequest) (*model.Role, error) {
	if req == nil {
		return nil, errors.New("invalid request")
	}
	role, err := s.GetRole(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if role.IsSystem {
		return nil, errors.New("system role can not be modified")
	}
	if strings.EqualFold(role.Code, model.RoleCodeAdmin) {
		return nil, errors.New("admin role can not be modified")
	}

	updates := map[string]any{}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("role name can not be empty")
		}
		updates["name"] = name
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Level != nil {
		updates["level"] = *req.Level
	}

	tx := s.db.WithContext(ctx).Begin()
	if len(updates) > 0 {
		if err := tx.Model(&model.Role{}).Where("id = ?", role.ID).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update role: %w", err)
		}
	}

	if req.PermissionIDs != nil {
		perms, err := s.findPermissionsByIDs(ctx, *req.PermissionIDs)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		target := &model.Role{ID: role.ID}
		if err := tx.Model(target).Association("Permissions").Replace(perms); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update role permissions: %w", err)
		}
	}
	if req.NamespaceIDs != nil {
		namespaces, err := s.findNamespacesByIDs(ctx, *req.NamespaceIDs)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		target := &model.Role{ID: role.ID}
		if err := tx.Model(target).Association("Namespaces").Replace(namespaces); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update role namespaces: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit update role transaction: %w", err)
	}
	return s.GetRole(ctx, roleID)
}

func (s *RoleService) DeleteRole(ctx context.Context, roleID string) error {
	role, err := s.GetRole(ctx, roleID)
	if err != nil {
		return err
	}
	if role.IsSystem {
		return errors.New("system role can not be deleted")
	}
	if strings.EqualFold(role.Code, model.RoleCodeAdmin) {
		return errors.New("admin role can not be deleted")
	}

	var assigned int64
	if err := s.db.WithContext(ctx).Table("user_roles").Where("role_id = ?", roleID).Count(&assigned).Error; err != nil {
		return fmt.Errorf("failed to check role assignment: %w", err)
	}
	if assigned > 0 {
		return errors.New("role is assigned to users, unbind users first")
	}

	tx := s.db.WithContext(ctx).Begin()
	target := &model.Role{ID: roleID}
	if err := tx.Model(target).Association("Permissions").Clear(); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear role permissions: %w", err)
	}
	if err := tx.Model(target).Association("Namespaces").Clear(); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear role namespaces: %w", err)
	}
	if err := tx.Delete(&model.Role{}, "id = ?", roleID).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete role: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit delete role transaction: %w", err)
	}

	s.logger.Info("Role deleted", zap.String("role_id", roleID))
	return nil
}

func (s *RoleService) findPermissionsByIDs(ctx context.Context, ids []string) ([]model.Permission, error) {
	if len(ids) == 0 {
		return []model.Permission{}, nil
	}

	unique := make(map[string]struct{}, len(ids))
	cleaned := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := unique[id]; exists {
			continue
		}
		unique[id] = struct{}{}
		cleaned = append(cleaned, id)
	}
	if len(cleaned) == 0 {
		return []model.Permission{}, nil
	}

	items := make([]model.Permission, 0, len(cleaned))
	if err := s.db.WithContext(ctx).Find(&items, "id IN ?", cleaned).Error; err != nil {
		return nil, fmt.Errorf("failed to query permissions: %w", err)
	}
	if len(items) != len(cleaned) {
		return nil, errors.New("some permission_ids are invalid")
	}
	return items, nil
}

func (s *RoleService) findNamespacesByIDs(ctx context.Context, ids []string) ([]model.Namespace, error) {
	if len(ids) == 0 {
		return []model.Namespace{}, nil
	}

	unique := make(map[string]struct{}, len(ids))
	cleaned := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := unique[id]; exists {
			continue
		}
		unique[id] = struct{}{}
		cleaned = append(cleaned, id)
	}
	if len(cleaned) == 0 {
		return []model.Namespace{}, nil
	}

	items := make([]model.Namespace, 0, len(cleaned))
	if err := s.db.WithContext(ctx).
		Find(&items, "id IN ?", cleaned).Error; err != nil {
		return nil, fmt.Errorf("failed to query namespaces: %w", err)
	}
	if len(items) != len(cleaned) {
		return nil, errors.New("some namespace_ids are invalid")
	}
	return items, nil
}

type CreateRoleRequest struct {
	Code          string   `json:"code" binding:"required"`
	Name          string   `json:"name" binding:"required"`
	Description   string   `json:"description"`
	Level         int      `json:"level"`
	PermissionIDs []string `json:"permission_ids"`
	NamespaceIDs  []string `json:"namespace_ids"`
}

type UpdateRoleRequest struct {
	Name          *string   `json:"name"`
	Description   *string   `json:"description"`
	Level         *int      `json:"level"`
	PermissionIDs *[]string `json:"permission_ids"`
	NamespaceIDs  *[]string `json:"namespace_ids"`
}
