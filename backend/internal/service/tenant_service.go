package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TenantService handles tenant CRUD and quota checks.
type TenantService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewTenantService(db *gorm.DB, logger *zap.Logger) *TenantService {
	return &TenantService{db: db, logger: logger}
}

func (s *TenantService) CreateTenant(ctx context.Context, req *CreateTenantRequest) (*model.Tenant, error) {
	req = s.applyCreateDefaults(req)

	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Tenant{}).Where("code = ?", req.Code).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to check tenant code: %w", err)
	}
	if count > 0 {
		return nil, errors.New("tenant code already exists")
	}

	tenant := &model.Tenant{
		Name:          req.Name,
		Code:          req.Code,
		Description:   req.Description,
		Status:        model.TenantStatusActive,
		Plan:          model.TenantPlan(req.Plan),
		MaxStorage:    req.MaxStorage,
		MaxNamespaces: req.MaxNamespaces,
		MaxUsers:      req.MaxUsers,
		MaxAPICalls:   req.MaxAPICalls,
		APICallsDate:  time.Now().UTC(),
	}

	if err := s.db.WithContext(ctx).Create(tenant).Error; err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	defaultNS := &model.Namespace{
		TenantID:    tenant.ID,
		Name:        "default",
		Description: "Default namespace",
		Status:      model.NSStatusActive,
		IsDefault:   true,
	}
	if err := s.db.WithContext(ctx).Create(defaultNS).Error; err != nil {
		s.logger.Error("failed to create default namespace", zap.Error(err))
	}

	adminRole := &model.Role{
		TenantID:    &tenant.ID,
		Code:        model.RoleCodeTenantAdmin,
		Name:        "Tenant Admin",
		Description: "Full control over tenant resources",
		IsSystem:    false,
		Level:       100,
	}
	if err := s.db.WithContext(ctx).Create(adminRole).Error; err != nil {
		s.logger.Error("failed to create admin role", zap.Error(err))
	}
	if err := s.bindDefaultPermissions(ctx, adminRole); err != nil {
		s.logger.Error("failed to bind default permissions", zap.Error(err))
	}

	s.logger.Info("Tenant created", zap.String("tenant_id", tenant.ID), zap.String("code", tenant.Code))
	return tenant, nil
}

func (s *TenantService) GetTenant(ctx context.Context, tenantID string) (*model.Tenant, error) {
	var tenant model.Tenant
	if err := s.db.WithContext(ctx).First(&tenant, "id = ?", tenantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tenant not found")
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	return &tenant, nil
}

func (s *TenantService) GetTenantByCode(ctx context.Context, code string) (*model.Tenant, error) {
	code = strings.ToLower(strings.TrimSpace(code))

	var tenant model.Tenant
	if err := s.db.WithContext(ctx).First(&tenant, "code = ?", code).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tenant not found")
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	return &tenant, nil
}

func (s *TenantService) ListTenants(ctx context.Context, req *ListTenantRequest) ([]*model.Tenant, int64, error) {
	if req == nil {
		req = &ListTenantRequest{}
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	var tenants []*model.Tenant
	var total int64
	query := s.db.WithContext(ctx).Model(&model.Tenant{})

	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.Keyword != "" {
		like := "%" + req.Keyword + "%"
		query = query.Where("name LIKE ? OR code LIKE ?", like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count tenants: %w", err)
	}

	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).Find(&tenants).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list tenants: %w", err)
	}

	return tenants, total, nil
}

func (s *TenantService) UpdateTenant(ctx context.Context, tenantID string, req *UpdateTenantRequest) (*model.Tenant, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.Plan != "" {
		updates["plan"] = req.Plan
	}
	if req.MaxStorage > 0 {
		updates["max_storage"] = req.MaxStorage
	}
	if req.MaxNamespaces > 0 {
		updates["max_namespaces"] = req.MaxNamespaces
	}
	if req.MaxUsers > 0 {
		updates["max_users"] = req.MaxUsers
	}
	if req.MaxAPICalls > 0 {
		updates["max_api_calls"] = req.MaxAPICalls
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(tenant).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update tenant: %w", err)
		}
	}

	return s.GetTenant(ctx, tenantID)
}

func (s *TenantService) DeleteTenant(ctx context.Context, tenantID string) error {
	result := s.db.WithContext(ctx).Delete(&model.Tenant{}, "id = ?", tenantID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete tenant: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("tenant not found")
	}

	s.logger.Info("Tenant deleted", zap.String("tenant_id", tenantID))
	return nil
}

func (s *TenantService) CheckQuota(ctx context.Context, tenantID string, quotaType QuotaType) error {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	switch quotaType {
	case QuotaTypeStorage:
		if tenant.UsedStorage >= tenant.MaxStorage {
			return errors.New("storage quota exceeded")
		}
	case QuotaTypeNamespace:
		if tenant.UsedNamespaces >= tenant.MaxNamespaces {
			return errors.New("namespace quota exceeded")
		}
	case QuotaTypeUser:
		if tenant.UsedUsers >= tenant.MaxUsers {
			return errors.New("user quota exceeded")
		}
	case QuotaTypeAPICalls:
		if tenant.UsedAPICalls >= tenant.MaxAPICalls {
			return errors.New("api calls quota exceeded")
		}
	}

	return nil
}

func (s *TenantService) CheckStorageGrowth(ctx context.Context, tenantID string, growBytes int64) error {
	if growBytes <= 0 {
		return nil
	}
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}
	if tenant.MaxStorage > 0 && tenant.UsedStorage+growBytes > tenant.MaxStorage {
		return errors.New("storage quota exceeded")
	}
	return nil
}

func (s *TenantService) applyCreateDefaults(req *CreateTenantRequest) *CreateTenantRequest {
	if req == nil {
		req = &CreateTenantRequest{}
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.ToLower(strings.TrimSpace(req.Code))
	req.Description = strings.TrimSpace(req.Description)
	if req.Plan == "" {
		req.Plan = string(model.TenantPlanFree)
	}
	if req.MaxStorage <= 0 {
		req.MaxStorage = 10 * 1024 * 1024 * 1024
	}
	if req.MaxNamespaces <= 0 {
		req.MaxNamespaces = 10
	}
	if req.MaxUsers <= 0 {
		req.MaxUsers = 100
	}
	if req.MaxAPICalls <= 0 {
		req.MaxAPICalls = 100000
	}
	return req
}

func (s *TenantService) bindDefaultPermissions(ctx context.Context, role *model.Role) error {
	resourceActions := map[string][]model.PermissionAction{
		"tenant":    {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList, model.ActionAdmin},
		"user":      {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
		"namespace": {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
		"storage":   {model.ActionCreate, model.ActionRead, model.ActionUpdate, model.ActionDelete, model.ActionList},
		"object":    {model.ActionCreate, model.ActionRead, model.ActionDelete, model.ActionList, model.ActionShare},
	}

	var permissions []model.Permission
	for resource, actions := range resourceActions {
		for _, action := range actions {
			code := fmt.Sprintf("%s:%s", resource, action)
			p := model.Permission{
				Code:        code,
				Name:        code,
				Description: "Auto generated default permission",
				Resource:    resource,
				Action:      action,
			}
			if err := s.db.WithContext(ctx).Where("code = ?", code).FirstOrCreate(&p).Error; err != nil {
				return err
			}
			permissions = append(permissions, p)
		}
	}

	return s.db.WithContext(ctx).Model(role).Association("Permissions").Replace(permissions)
}

func (s *TenantService) EnsurePlatformAdminRole(ctx context.Context) (*model.Role, error) {
	resourceActions := map[string][]model.PermissionAction{
		"tenant":    {model.ActionAdmin},
		"user":      {model.ActionAdmin},
		"namespace": {model.ActionAdmin},
		"storage":   {model.ActionAdmin},
		"object":    {model.ActionAdmin},
	}

	permissions := make([]model.Permission, 0, len(resourceActions))
	for resource, actions := range resourceActions {
		for _, action := range actions {
			code := fmt.Sprintf("%s:%s", resource, action)
			p := model.Permission{
				Code:        code,
				Name:        code,
				Description: "Auto generated platform admin permission",
				Resource:    resource,
				Action:      action,
			}
			if err := s.db.WithContext(ctx).Where("code = ?", code).FirstOrCreate(&p).Error; err != nil {
				return nil, err
			}
			permissions = append(permissions, p)
		}
	}

	role := &model.Role{}
	if err := s.db.WithContext(ctx).
		Where("tenant_id IS NULL AND code = ?", model.RoleCodePlatformAdmin).
		First(role).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		role = &model.Role{
			TenantID:    nil,
			Code:        model.RoleCodePlatformAdmin,
			Name:        "Platform Admin",
			Description: "Full control over all tenants",
			IsSystem:    true,
			Level:       1000,
		}
		if err := s.db.WithContext(ctx).Create(role).Error; err != nil {
			return nil, err
		}
	}

	if err := s.db.WithContext(ctx).Model(role).Association("Permissions").Replace(permissions); err != nil {
		return nil, err
	}
	return role, nil
}

type CreateTenantRequest struct {
	Name          string `json:"name" binding:"required"`
	Code          string `json:"code" binding:"required"`
	Description   string `json:"description"`
	Plan          string `json:"plan"`
	MaxStorage    int64  `json:"max_storage"`
	MaxNamespaces int    `json:"max_namespaces"`
	MaxUsers      int    `json:"max_users"`
	MaxAPICalls   int64  `json:"max_api_calls"`
}

type UpdateTenantRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Status        string `json:"status"`
	Plan          string `json:"plan"`
	MaxStorage    int64  `json:"max_storage"`
	MaxNamespaces int    `json:"max_namespaces"`
	MaxUsers      int    `json:"max_users"`
	MaxAPICalls   int64  `json:"max_api_calls"`
}

type ListTenantRequest struct {
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	Status   string `form:"status"`
	Keyword  string `form:"keyword"`
}

type QuotaType string

const (
	QuotaTypeStorage   QuotaType = "storage"
	QuotaTypeNamespace QuotaType = "namespace"
	QuotaTypeUser      QuotaType = "user"
	QuotaTypeAPICalls  QuotaType = "api_calls"
)
