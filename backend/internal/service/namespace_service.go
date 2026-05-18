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

// NamespaceService manages namespace CRUD.
type NamespaceService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewNamespaceService(db *gorm.DB, logger *zap.Logger) *NamespaceService {
	return &NamespaceService{
		db:     db,
		logger: logger,
	}
}

func (s *NamespaceService) CreateNamespace(ctx context.Context, req *CreateNamespaceRequest) (*model.Namespace, error) {
	if req.MaxStorage != nil && *req.MaxStorage <= 0 {
		return nil, errors.New("max_storage must be greater than 0")
	}
	if req.MaxFiles != nil && *req.MaxFiles <= 0 {
		return nil, errors.New("max_files must be greater than 0")
	}
	if req.MaxFileSize != nil && *req.MaxFileSize <= 0 {
		return nil, errors.New("max_file_size must be greater than 0")
	}

	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Namespace{}).Where("name = ?", req.Name).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to check namespace name: %w", err)
	}
	if count > 0 {
		return nil, errors.New("namespace name already exists")
	}

	ns := &model.Namespace{
		Name:        req.Name,
		Description: req.Description,
		Status:      model.NSStatusActive,
		PathPrefix:  req.PathPrefix,
		MaxStorage:  req.MaxStorage,
		MaxFiles:    req.MaxFiles,
		MaxFileSize: req.MaxFileSize,
	}
	if storageConfigID := strings.TrimSpace(req.StorageConfigID); storageConfigID != "" {
		ns.StorageConfigID = &storageConfigID
	}
	if ownerID := strings.TrimSpace(req.OwnerUserID); ownerID != "" {
		ns.OwnerUserID = &ownerID
	}

	if err := s.db.WithContext(ctx).Create(ns).Error; err != nil {
		return nil, fmt.Errorf("failed to create namespace: %w", err)
	}

	s.logger.Info("Namespace created",
		zap.String("namespace_id", ns.ID),
		zap.String("name", ns.Name),
	)

	return ns, nil
}

func (s *NamespaceService) GetNamespace(ctx context.Context, namespaceID string) (*model.Namespace, error) {
	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("namespace not found")
		}
		return nil, fmt.Errorf("failed to get namespace: %w", err)
	}
	return &ns, nil
}

func (s *NamespaceService) ListNamespaces(ctx context.Context, req *ListNamespaceRequest) ([]*model.Namespace, int64, error) {
	if req == nil {
		req = &ListNamespaceRequest{Page: 1, PageSize: 20}
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	var namespaces []*model.Namespace
	var total int64

	query := s.db.WithContext(ctx).Model(&model.Namespace{})
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

func (s *NamespaceService) UpdateNamespace(ctx context.Context, namespaceID string, req *UpdateNamespaceRequest) (*model.Namespace, error) {
	ns, err := s.GetNamespace(ctx, namespaceID)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
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
	if req.OwnerUserID != nil {
		ownerID := strings.TrimSpace(*req.OwnerUserID)
		if ownerID == "" {
			updates["owner_user_id"] = nil
		} else {
			updates["owner_user_id"] = ownerID
		}
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(ns).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update namespace: %w", err)
		}
	}

	return s.GetNamespace(ctx, namespaceID)
}

func (s *NamespaceService) DeleteNamespace(ctx context.Context, namespaceID string) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Object{}).Where("namespace_id = ?", namespaceID).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check objects: %w", err)
	}
	if count > 0 {
		return errors.New("namespace is not empty, please delete objects first")
	}

	result := s.db.WithContext(ctx).Delete(&model.Namespace{}, "id = ?", namespaceID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete namespace: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("namespace not found")
	}

	s.logger.Info("Namespace deleted", zap.String("namespace_id", namespaceID))
	return nil
}

type CreateNamespaceRequest struct {
	Name            string `json:"name" binding:"required"`
	Description     string `json:"description"`
	StorageConfigID string `json:"storage_config_id"`
	OwnerUserID     string `json:"owner_user_id"`
	PathPrefix      string `json:"path_prefix"`
	MaxStorage      *int64 `json:"max_storage"`
	MaxFiles        *int   `json:"max_files"`
	MaxFileSize     *int64 `json:"max_file_size"`
}

type UpdateNamespaceRequest struct {
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Status          string  `json:"status"`
	StorageConfigID string  `json:"storage_config_id"`
	OwnerUserID     *string `json:"owner_user_id"`
	PathPrefix      string  `json:"path_prefix"`
	MaxStorage      *int64  `json:"max_storage"`
	MaxFiles        *int    `json:"max_files"`
	MaxFileSize     *int64  `json:"max_file_size"`
}

type ListNamespaceRequest struct {
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
	Status       string `form:"status"`
	NamespaceIDs []string
}
