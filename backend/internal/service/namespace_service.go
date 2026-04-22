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

// NamespaceService 命名空间服务
type NamespaceService struct {
	db     *gorm.DB
	logger *zap.Logger
}

// NewNamespaceService 创建命名空间服务
func NewNamespaceService(db *gorm.DB, logger *zap.Logger) *NamespaceService {
	return &NamespaceService{
		db:     db,
		logger: logger,
	}
}

// CreateNamespace 创建命名空间
func (s *NamespaceService) CreateNamespace(ctx context.Context, tenantID string, req *CreateNamespaceRequest) (*model.Namespace, error) {
	if req.MaxStorage != nil && *req.MaxStorage <= 0 {
		return nil, errors.New("max_storage must be greater than 0")
	}
	if req.MaxFiles != nil && *req.MaxFiles <= 0 {
		return nil, errors.New("max_files must be greater than 0")
	}
	if req.MaxFileSize != nil && *req.MaxFileSize <= 0 {
		return nil, errors.New("max_file_size must be greater than 0")
	}

	// 检查命名空间名称是否已存在
	var count int64
	if err := s.db.Model(&model.Namespace{}).Where("tenant_id = ? AND name = ?", tenantID, req.Name).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to check namespace name: %w", err)
	}
	if count > 0 {
		return nil, errors.New("namespace name already exists")
	}

	ns := &model.Namespace{
		TenantID:        tenantID,
		Name:            req.Name,
		Description:     req.Description,
		Status:          model.NSStatusActive,
		PathPrefix:      req.PathPrefix,
		MaxStorage:      req.MaxStorage,
		MaxFiles:        req.MaxFiles,
		MaxFileSize:     req.MaxFileSize,
	}
	if storageConfigID := strings.TrimSpace(req.StorageConfigID); storageConfigID != "" {
		ns.StorageConfigID = &storageConfigID
	}

	if err := s.db.Create(ns).Error; err != nil {
		return nil, fmt.Errorf("failed to create namespace: %w", err)
	}

	s.logger.Info("Namespace created",
		zap.String("namespace_id", ns.ID),
		zap.String("tenant_id", tenantID),
		zap.String("name", ns.Name),
	)

	return ns, nil
}

// GetNamespace 获取命名空间
func (s *NamespaceService) GetNamespace(ctx context.Context, namespaceID string) (*model.Namespace, error) {
	var ns model.Namespace
	if err := s.db.Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("namespace not found")
		}
		return nil, fmt.Errorf("failed to get namespace: %w", err)
	}
	return &ns, nil
}

// ListNamespaces 列出命名空间
func (s *NamespaceService) ListNamespaces(ctx context.Context, tenantID string, req *ListNamespaceRequest) ([]*model.Namespace, int64, error) {
	var namespaces []*model.Namespace
	var total int64

	query := s.db.Model(&model.Namespace{}).Where("tenant_id = ?", tenantID)
	if len(req.NamespaceIDs) > 0 {
		query = query.Where("id IN ?", req.NamespaceIDs)
	}

	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count namespaces: %w", err)
	}

	offset := (req.Page - 1) * req.PageSize
	if err := query.Preload("StorageConfig").Offset(offset).Limit(req.PageSize).Find(&namespaces).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list namespaces: %w", err)
	}

	return namespaces, total, nil
}

// UpdateNamespace 更新命名空间
func (s *NamespaceService) UpdateNamespace(ctx context.Context, namespaceID string, req *UpdateNamespaceRequest) (*model.Namespace, error) {
	ns, err := s.GetNamespace(ctx, namespaceID)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.StorageConfigID != "" {
		updates["storage_config_id"] = req.StorageConfigID
	}
	if req.PathPrefix != "" {
		updates["path_prefix"] = req.PathPrefix
	}
	if req.MaxStorage != nil {
		if *req.MaxStorage <= 0 {
			return nil, errors.New("max_storage must be greater than 0")
		}
		updates["max_storage"] = *req.MaxStorage
	}
	if req.MaxFiles != nil {
		if *req.MaxFiles <= 0 {
			return nil, errors.New("max_files must be greater than 0")
		}
		updates["max_files"] = *req.MaxFiles
	}
	if req.MaxFileSize != nil {
		if *req.MaxFileSize <= 0 {
			return nil, errors.New("max_file_size must be greater than 0")
		}
		updates["max_file_size"] = *req.MaxFileSize
	}

	if len(updates) > 0 {
		if err := s.db.Model(ns).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update namespace: %w", err)
		}
	}

	return ns, nil
}

// DeleteNamespace 删除命名空间
func (s *NamespaceService) DeleteNamespace(ctx context.Context, namespaceID string) error {
	// 检查是否有对象
	var count int64
	if err := s.db.Model(&model.Object{}).Where("namespace_id = ?", namespaceID).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check objects: %w", err)
	}
	if count > 0 {
		return errors.New("namespace is not empty, please delete objects first")
	}

	result := s.db.Delete(&model.Namespace{}, "id = ?", namespaceID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete namespace: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("namespace not found")
	}

	s.logger.Info("Namespace deleted", zap.String("namespace_id", namespaceID))
	return nil
}

// DTO 定义

type CreateNamespaceRequest struct {
	Name            string `json:"name" binding:"required"`
	Description     string `json:"description"`
	StorageConfigID string `json:"storage_config_id"`
	PathPrefix      string `json:"path_prefix"`
	MaxStorage      *int64 `json:"max_storage"`
	MaxFiles        *int   `json:"max_files"`
	MaxFileSize     *int64 `json:"max_file_size"`
}

type UpdateNamespaceRequest struct {
	Description     string `json:"description"`
	Status          string `json:"status"`
	StorageConfigID string `json:"storage_config_id"`
	PathPrefix      string `json:"path_prefix"`
	MaxStorage      *int64 `json:"max_storage"`
	MaxFiles        *int   `json:"max_files"`
	MaxFileSize     *int64 `json:"max_file_size"`
}

type ListNamespaceRequest struct {
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
	Status       string `form:"status"`
	NamespaceIDs []string
}
