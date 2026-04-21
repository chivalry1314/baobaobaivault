package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/baobaobao/baobaobaivault/internal/model"
	"github.com/baobaobao/baobaobaivault/internal/storage"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// StorageService provides storage config and object operations.
type StorageService struct {
	db       *gorm.DB
	logger   *zap.Logger
	registry *storage.Registry
}

func NewStorageService(db *gorm.DB, logger *zap.Logger, registry *storage.Registry) *StorageService {
	return &StorageService{db: db, logger: logger, registry: registry}
}

func (s *StorageService) CreateStorageConfig(ctx context.Context, tenantID string, req *CreateStorageConfigRequest) (*model.StorageConfig, error) {
	provider := strings.ToLower(req.Provider)
	if provider == "" {
		return nil, errors.New("provider is required")
	}

	config := &model.StorageConfig{
		TenantID:    tenantID,
		Name:        req.Name,
		Provider:    model.StorageProvider(provider),
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		Bucket:      req.Bucket,
		AccessKey:   req.AccessKey,
		SecretKey:   req.SecretKey,
		PathStyle:   req.PathStyle,
		IsDefault:   req.IsDefault,
		Status:      model.StorageConfigStatusActive,
		ExtraConfig: req.ExtraConfig,
	}

	if err := s.db.WithContext(ctx).Create(config).Error; err != nil {
		return nil, fmt.Errorf("failed to create storage config: %w", err)
	}

	if config.IsDefault {
		_ = s.db.WithContext(ctx).Model(&model.StorageConfig{}).
			Where("tenant_id = ? AND id != ?", tenantID, config.ID).
			Update("is_default", false).Error
	}

	s.logger.Info("Storage config created",
		zap.String("config_id", config.ID),
		zap.String("tenant_id", tenantID),
		zap.String("provider", string(config.Provider)),
	)

	return config, nil
}

func (s *StorageService) GetStorageConfig(ctx context.Context, configID string) (*model.StorageConfig, error) {
	var config model.StorageConfig
	if err := s.db.WithContext(ctx).First(&config, "id = ?", configID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("storage config not found")
		}
		return nil, fmt.Errorf("failed to get storage config: %w", err)
	}
	return &config, nil
}

func (s *StorageService) ListStorageConfigs(ctx context.Context, tenantID string) ([]*model.StorageConfig, error) {
	var configs []*model.StorageConfig
	if err := s.db.WithContext(ctx).Find(&configs, "tenant_id = ?", tenantID).Error; err != nil {
		return nil, fmt.Errorf("failed to list storage configs: %w", err)
	}
	return configs, nil
}

func (s *StorageService) DeleteStorageConfig(ctx context.Context, configID string) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Namespace{}).
		Where("storage_config_id = ?", configID).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check namespaces: %w", err)
	}
	if count > 0 {
		return errors.New("storage config is in use by namespaces")
	}

	result := s.db.WithContext(ctx).Delete(&model.StorageConfig{}, "id = ?", configID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete storage config: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("storage config not found")
	}

	s.logger.Info("Storage config deleted", zap.String("config_id", configID))
	return nil
}

func (s *StorageService) PutObject(
	ctx context.Context,
	namespaceID string,
	key string,
	reader io.Reader,
	size int64,
	contentType string,
	metadata map[string]string,
) (*model.Object, error) {
	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return nil, err
	}

	versionID := newVersionID()
	storageKey := s.buildVersionedStorageKey(&ns, key, versionID)
	opts := []storage.Option{storage.WithContentType(contentType)}
	if metadata != nil {
		opts = append(opts, storage.WithMetadata(metadata))
	}

	objInfo, err := provider.Put(ctx, storageKey, reader, size, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to put object: %w", err)
	}

	now := time.Now().UTC()
	metaJSON := marshalMetadata(metadata)

	var existing model.Object
	err = s.db.WithContext(ctx).
		First(&existing, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to check existing object metadata: %w", err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		object := &model.Object{
			NamespaceID:  namespaceID,
			Key:          key,
			Name:         filepath.Base(key),
			Size:         size,
			ContentType:  contentType,
			ETag:         objInfo.ETag,
			VersionID:    versionID,
			StorageKey:   storageKey,
			LastModified: now,
			Metadata:     metaJSON,
			IsLatest:     true,
		}

		tx := s.db.WithContext(ctx).Begin()
		if err := tx.Create(object).Error; err != nil {
			tx.Rollback()
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to save object metadata: %w", err)
		}
		version := &model.ObjectVersion{
			ObjectID:   object.ID,
			VersionID:  versionID,
			Size:       size,
			ETag:       objInfo.ETag,
			StorageKey: storageKey,
			IsLatest:   true,
		}
		if err := tx.Create(version).Error; err != nil {
			tx.Rollback()
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to save object version: %w", err)
		}
		if err := tx.Model(&ns).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error; err != nil {
			tx.Rollback()
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to update namespace storage usage: %w", err)
		}
		if err := tx.Model(&ns).Update("used_files", gorm.Expr("used_files + ?", 1)).Error; err != nil {
			tx.Rollback()
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to update namespace file usage: %w", err)
		}
		if err := tx.Commit().Error; err != nil {
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to commit object transaction: %w", err)
		}

		s.logger.Info("Object uploaded",
			zap.String("object_id", object.ID),
			zap.String("namespace_id", namespaceID),
			zap.String("key", key),
			zap.Int64("size", size),
			zap.String("version_id", versionID),
		)
		return object, nil
	}

	previousVersionID := strings.TrimSpace(existing.VersionID)
	if previousVersionID == "" {
		previousVersionID = fmt.Sprintf("legacy-%d", existing.CreatedAt.UnixNano())
	}

	tx := s.db.WithContext(ctx).Begin()
	if err := tx.Model(&model.ObjectVersion{}).
		Where("object_id = ?", existing.ID).
		Update("is_latest", false).Error; err != nil {
		tx.Rollback()
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to mark previous versions: %w", err)
	}

	var oldVersionCount int64
	if err := tx.Model(&model.ObjectVersion{}).
		Where("object_id = ? AND version_id = ?", existing.ID, previousVersionID).
		Count(&oldVersionCount).Error; err != nil {
		tx.Rollback()
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to check previous version row: %w", err)
	}
	if oldVersionCount == 0 {
		prevVersion := &model.ObjectVersion{
			ObjectID:   existing.ID,
			VersionID:  previousVersionID,
			Size:       existing.Size,
			ETag:       existing.ETag,
			StorageKey: existing.StorageKey,
			IsLatest:   false,
		}
		if err := tx.Create(prevVersion).Error; err != nil {
			tx.Rollback()
			_ = provider.Delete(ctx, storageKey)
			return nil, fmt.Errorf("failed to save previous version metadata: %w", err)
		}
	}

	if err := tx.Model(&existing).Updates(map[string]any{
		"size":          size,
		"content_type":  contentType,
		"etag":          objInfo.ETag,
		"version_id":    versionID,
		"storage_key":   storageKey,
		"metadata":      metaJSON,
		"last_modified": now,
		"is_latest":     true,
		"name":          filepath.Base(key),
	}).Error; err != nil {
		tx.Rollback()
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to update latest object metadata: %w", err)
	}

	newVersion := &model.ObjectVersion{
		ObjectID:   existing.ID,
		VersionID:  versionID,
		Size:       size,
		ETag:       objInfo.ETag,
		StorageKey: storageKey,
		IsLatest:   true,
	}
	if err := tx.Create(newVersion).Error; err != nil {
		tx.Rollback()
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to save new object version: %w", err)
	}

	if err := tx.Model(&ns).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error; err != nil {
		tx.Rollback()
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to update namespace storage usage: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		_ = provider.Delete(ctx, storageKey)
		return nil, fmt.Errorf("failed to commit object version transaction: %w", err)
	}

	existing.Size = size
	existing.ContentType = contentType
	existing.ETag = objInfo.ETag
	existing.VersionID = versionID
	existing.StorageKey = storageKey
	existing.Metadata = metaJSON
	existing.LastModified = now
	existing.Name = filepath.Base(key)
	existing.IsLatest = true

	s.logger.Info("Object uploaded",
		zap.String("object_id", existing.ID),
		zap.String("namespace_id", namespaceID),
		zap.String("key", key),
		zap.Int64("size", size),
		zap.String("version_id", versionID),
	)
	return &existing, nil
}

func (s *StorageService) GetObject(ctx context.Context, namespaceID, key string) (io.ReadCloser, *model.Object, error) {
	var object model.Object
	if err := s.db.WithContext(ctx).
		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("object not found")
		}
		return nil, nil, fmt.Errorf("failed to get object metadata: %w", err)
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return nil, nil, fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return nil, nil, err
	}

	reader, _, err := provider.Get(ctx, object.StorageKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get object from storage: %w", err)
	}

	return reader, &object, nil
}

func (s *StorageService) DeleteObject(ctx context.Context, namespaceID, key string) error {
	var object model.Object
	if err := s.db.WithContext(ctx).
		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("failed to get object metadata: %w", err)
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).First(&ns, "id = ?", namespaceID).Error; err != nil {
		return fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return err
	}

	var versions []*model.ObjectVersion
	if err := s.db.WithContext(ctx).
		Where("object_id = ?", object.ID).
		Find(&versions).Error; err != nil {
		return fmt.Errorf("failed to list object versions: %w", err)
	}

	type versionAggregate struct {
		seenKeys map[string]struct{}
		total    int64
	}
	agg := &versionAggregate{seenKeys: map[string]struct{}{}}
	for _, item := range versions {
		if item.StorageKey != "" {
			agg.seenKeys[item.StorageKey] = struct{}{}
		}
		agg.total += item.Size
	}
	if len(versions) == 0 {
		agg.total = object.Size
		if object.StorageKey != "" {
			agg.seenKeys[object.StorageKey] = struct{}{}
		}
	}

	tx := s.db.WithContext(ctx).Begin()
	if err := tx.Where("object_id = ?", object.ID).Delete(&model.ObjectVersion{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete object versions metadata: %w", err)
	}
	if err := tx.Delete(&object).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete object metadata: %w", err)
	}
	if err := tx.Model(&ns).Update("used_storage", gorm.Expr("CASE WHEN used_storage >= ? THEN used_storage - ? ELSE 0 END", agg.total, agg.total)).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update namespace storage usage: %w", err)
	}
	if err := tx.Model(&ns).Update("used_files", gorm.Expr("CASE WHEN used_files > 0 THEN used_files - 1 ELSE 0 END")).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update namespace file usage: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit delete object transaction: %w", err)
	}

	for storageKey := range agg.seenKeys {
		if err := provider.Delete(ctx, storageKey); err != nil {
			s.logger.Error("failed to delete version object from storage", zap.Error(err), zap.String("storage_key", storageKey))
		}
	}

	s.logger.Info("Object deleted", zap.String("namespace_id", namespaceID), zap.String("key", key))
	return nil
}

func (s *StorageService) ListObjects(ctx context.Context, namespaceID, prefix string, page, pageSize int) ([]*model.Object, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	var objects []*model.Object
	var total int64

	query := s.db.WithContext(ctx).Model(&model.Object{}).
		Where("namespace_id = ? AND is_latest = ?", namespaceID, true)
	if prefix != "" {
		query = query.Where("key LIKE ?", prefix+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count objects: %w", err)
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&objects).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list objects: %w", err)
	}

	return objects, total, nil
}

func (s *StorageService) ListObjectVersions(ctx context.Context, namespaceID, key string, page, pageSize int) ([]*model.ObjectVersion, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	var object model.Object
	if err := s.db.WithContext(ctx).
		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, errors.New("object not found")
		}
		return nil, 0, fmt.Errorf("failed to get object metadata: %w", err)
	}

	var total int64
	query := s.db.WithContext(ctx).Model(&model.ObjectVersion{}).Where("object_id = ?", object.ID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count object versions: %w", err)
	}

	items := make([]*model.ObjectVersion, 0, pageSize)
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list object versions: %w", err)
	}
	return items, total, nil
}

func (s *StorageService) RollbackObjectVersion(ctx context.Context, namespaceID, key, versionID string) (*model.Object, error) {
	versionID = strings.TrimSpace(versionID)
	if versionID == "" {
		return nil, errors.New("version_id is required")
	}

	var object model.Object
	if err := s.db.WithContext(ctx).
		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("object not found")
		}
		return nil, fmt.Errorf("failed to get object metadata: %w", err)
	}

	var target model.ObjectVersion
	if err := s.db.WithContext(ctx).
		First(&target, "object_id = ? AND version_id = ?", object.ID, versionID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("target version not found")
		}
		return nil, fmt.Errorf("failed to get target object version: %w", err)
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}
	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return nil, err
	}
	if _, err := provider.Stat(ctx, target.StorageKey); err != nil {
		return nil, fmt.Errorf("target version data not found: %w", err)
	}

	tx := s.db.WithContext(ctx).Begin()
	if err := tx.Model(&model.ObjectVersion{}).
		Where("object_id = ?", object.ID).
		Update("is_latest", false).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset version latest flag: %w", err)
	}
	if err := tx.Model(&model.ObjectVersion{}).
		Where("id = ?", target.ID).
		Update("is_latest", true).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to set target version latest: %w", err)
	}

	now := time.Now().UTC()
	if err := tx.Model(&object).Updates(map[string]any{
		"size":          target.Size,
		"etag":          target.ETag,
		"storage_key":   target.StorageKey,
		"version_id":    target.VersionID,
		"is_latest":     true,
		"last_modified": now,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update object latest pointer: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit rollback transaction: %w", err)
	}

	object.Size = target.Size
	object.ETag = target.ETag
	object.StorageKey = target.StorageKey
	object.VersionID = target.VersionID
	object.LastModified = now
	object.IsLatest = true

	s.logger.Info("Object version rollback completed",
		zap.String("namespace_id", namespaceID),
		zap.String("key", key),
		zap.String("target_version_id", versionID),
	)

	return &object, nil
}

func (s *StorageService) PresignGetObject(ctx context.Context, namespaceID, key string, ttl time.Duration) (string, error) {
	var object model.Object
	if err := s.db.WithContext(ctx).
		First(&object, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("object not found")
		}
		return "", fmt.Errorf("failed to get object metadata: %w", err)
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return "", fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return "", err
	}

	url, err := provider.PresignGet(ctx, object.StorageKey, ttl)
	if err != nil {
		return "", fmt.Errorf("failed to presign url: %w", err)
	}
	return url, nil
}

type PreparedPresignPut struct {
	URL        string `json:"url"`
	Key        string `json:"key"`
	VersionID  string `json:"version_id"`
	StorageKey string `json:"storage_key"`
}

func (s *StorageService) PreparePresignPutObject(ctx context.Context, namespaceID, key string, ttl time.Duration) (*PreparedPresignPut, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil, errors.New("object key is required")
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return nil, err
	}

	versionID := newVersionID()
	storageKey := s.buildVersionedStorageKey(&ns, key, versionID)
	url, err := provider.PresignPut(ctx, storageKey, ttl)
	if err != nil {
		return nil, fmt.Errorf("failed to presign put url: %w", err)
	}

	return &PreparedPresignPut{
		URL:        url,
		Key:        key,
		VersionID:  versionID,
		StorageKey: storageKey,
	}, nil
}

func (s *StorageService) PresignPutObject(ctx context.Context, namespaceID, key string, ttl time.Duration) (string, error) {
	result, err := s.PreparePresignPutObject(ctx, namespaceID, key, ttl)
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

func (s *StorageService) FinalizePresignedPut(
	ctx context.Context,
	namespaceID string,
	key string,
	versionID string,
	contentType string,
	metadata map[string]string,
) (*model.Object, error) {
	key = strings.TrimSpace(key)
	versionID = strings.TrimSpace(versionID)
	if key == "" {
		return nil, errors.New("object key is required")
	}
	if versionID == "" {
		return nil, errors.New("version_id is required")
	}

	var ns model.Namespace
	if err := s.db.WithContext(ctx).Preload("StorageConfig").First(&ns, "id = ?", namespaceID).Error; err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}

	provider, err := s.getProviderForNamespace(ctx, &ns)
	if err != nil {
		return nil, err
	}

	storageKey := s.buildVersionedStorageKey(&ns, key, versionID)
	info, err := provider.Stat(ctx, storageKey)
	if err != nil {
		return nil, fmt.Errorf("failed to stat presigned uploaded object: %w", err)
	}
	size := info.Size
	etag := info.ETag
	if strings.TrimSpace(contentType) == "" {
		contentType = info.ContentType
	}
	now := time.Now().UTC()
	metaJSON := marshalMetadata(metadata)

	tx := s.db.WithContext(ctx).Begin()

	var tenant model.Tenant
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&tenant, "id = ?", ns.TenantID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("tenant not found: %w", err)
	}
	if tenant.MaxStorage > 0 && tenant.UsedStorage+size > tenant.MaxStorage {
		tx.Rollback()
		return nil, errors.New("storage quota exceeded")
	}

	var lockedNS model.Namespace
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&lockedNS, "id = ?", namespaceID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to lock namespace: %w", err)
	}
	if lockedNS.MaxFileSize != nil && *lockedNS.MaxFileSize > 0 && size > *lockedNS.MaxFileSize {
		tx.Rollback()
		return nil, errors.New("namespace max file size exceeded")
	}
	if lockedNS.MaxStorage != nil && *lockedNS.MaxStorage > 0 && lockedNS.UsedStorage+size > *lockedNS.MaxStorage {
		tx.Rollback()
		return nil, errors.New("namespace storage quota exceeded")
	}

	var existing model.Object
	err = tx.
		First(&existing, "namespace_id = ? AND key = ? AND is_latest = ?", namespaceID, key, true).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return nil, fmt.Errorf("failed to query object metadata: %w", err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		if lockedNS.MaxFiles != nil && *lockedNS.MaxFiles > 0 && lockedNS.UsedFiles+1 > *lockedNS.MaxFiles {
			tx.Rollback()
			return nil, errors.New("namespace max files quota exceeded")
		}

		object := &model.Object{
			NamespaceID:  namespaceID,
			Key:          key,
			Name:         filepath.Base(key),
			Size:         size,
			ContentType:  contentType,
			ETag:         etag,
			VersionID:    versionID,
			StorageKey:   storageKey,
			LastModified: now,
			Metadata:     metaJSON,
			IsLatest:     true,
		}
		if err := tx.Create(object).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to save object metadata: %w", err)
		}
		version := &model.ObjectVersion{
			ObjectID:   object.ID,
			VersionID:  versionID,
			Size:       size,
			ETag:       etag,
			StorageKey: storageKey,
			IsLatest:   true,
		}
		if err := tx.Create(version).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to save object version: %w", err)
		}
		if err := tx.Model(&lockedNS).Updates(map[string]any{
			"used_storage": gorm.Expr("used_storage + ?", size),
			"used_files":   gorm.Expr("used_files + ?", 1),
		}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update namespace usage: %w", err)
		}
		if err := tx.Model(&tenant).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update tenant storage usage: %w", err)
		}
		if err := tx.Commit().Error; err != nil {
			return nil, fmt.Errorf("failed to commit finalize presigned upload transaction: %w", err)
		}

		s.logger.Info("Presigned upload finalized",
			zap.String("object_id", object.ID),
			zap.String("namespace_id", namespaceID),
			zap.String("key", key),
			zap.String("version_id", versionID),
			zap.Int64("size", size),
		)
		return object, nil
	}

	if existing.VersionID == versionID && existing.StorageKey == storageKey {
		existing.Size = size
		existing.ETag = etag
		existing.ContentType = contentType
		existing.Metadata = metaJSON
		existing.LastModified = now
		if err := tx.Model(&existing).Updates(map[string]any{
			"size":          size,
			"etag":          etag,
			"content_type":  contentType,
			"metadata":      metaJSON,
			"last_modified": now,
		}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to refresh existing latest metadata: %w", err)
		}
		if err := tx.Commit().Error; err != nil {
			return nil, fmt.Errorf("failed to commit idempotent finalize transaction: %w", err)
		}
		return &existing, nil
	}

	previousVersionID := strings.TrimSpace(existing.VersionID)
	if previousVersionID == "" {
		previousVersionID = fmt.Sprintf("legacy-%d", existing.CreatedAt.UnixNano())
	}

	if err := tx.Model(&model.ObjectVersion{}).
		Where("object_id = ?", existing.ID).
		Update("is_latest", false).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to mark previous versions: %w", err)
	}

	var oldVersionCount int64
	if err := tx.Model(&model.ObjectVersion{}).
		Where("object_id = ? AND version_id = ?", existing.ID, previousVersionID).
		Count(&oldVersionCount).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to check previous version row: %w", err)
	}
	if oldVersionCount == 0 {
		prevVersion := &model.ObjectVersion{
			ObjectID:   existing.ID,
			VersionID:  previousVersionID,
			Size:       existing.Size,
			ETag:       existing.ETag,
			StorageKey: existing.StorageKey,
			IsLatest:   false,
		}
		if err := tx.Create(prevVersion).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to save previous version metadata: %w", err)
		}
	}

	if err := tx.Model(&existing).Updates(map[string]any{
		"size":          size,
		"content_type":  contentType,
		"etag":          etag,
		"version_id":    versionID,
		"storage_key":   storageKey,
		"metadata":      metaJSON,
		"last_modified": now,
		"is_latest":     true,
		"name":          filepath.Base(key),
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update latest object metadata: %w", err)
	}

	newVersion := &model.ObjectVersion{
		ObjectID:   existing.ID,
		VersionID:  versionID,
		Size:       size,
		ETag:       etag,
		StorageKey: storageKey,
		IsLatest:   true,
	}
	if err := tx.Create(newVersion).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to save new object version: %w", err)
	}

	if err := tx.Model(&lockedNS).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update namespace storage usage: %w", err)
	}
	if err := tx.Model(&tenant).Update("used_storage", gorm.Expr("used_storage + ?", size)).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update tenant storage usage: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit finalize presigned upload transaction: %w", err)
	}

	existing.Size = size
	existing.ContentType = contentType
	existing.ETag = etag
	existing.VersionID = versionID
	existing.StorageKey = storageKey
	existing.Metadata = metaJSON
	existing.LastModified = now
	existing.Name = filepath.Base(key)
	existing.IsLatest = true

	s.logger.Info("Presigned upload finalized",
		zap.String("object_id", existing.ID),
		zap.String("namespace_id", namespaceID),
		zap.String("key", key),
		zap.String("version_id", versionID),
		zap.Int64("size", size),
	)
	return &existing, nil
}

func (s *StorageService) getProviderForNamespace(ctx context.Context, ns *model.Namespace) (storage.StorageProvider, error) {
	var cfg *model.StorageConfig

	if ns.StorageConfigID != "" {
		found, err := s.GetStorageConfig(ctx, ns.StorageConfigID)
		if err != nil {
			return nil, fmt.Errorf("failed to get storage config: %w", err)
		}
		cfg = found
	} else {
		var defaultConfig model.StorageConfig
		if err := s.db.WithContext(ctx).First(&defaultConfig, "tenant_id = ? AND is_default = ?", ns.TenantID, true).Error; err != nil {
			return nil, fmt.Errorf("no default storage config found: %w", err)
		}
		cfg = &defaultConfig
	}

	provider, exists := s.registry.Get(cfg.ID)
	if !exists {
		factory := storage.NewProviderFactory(s.registry)
		if err := factory.CreateAndRegister(ctx, cfg); err != nil {
			return nil, fmt.Errorf("failed to create storage provider: %w", err)
		}
		provider, _ = s.registry.Get(cfg.ID)
	}
	return provider, nil
}

func (s *StorageService) buildStorageKey(ns *model.Namespace, key string) string {
	key = strings.TrimPrefix(key, "/")
	if ns.PathPrefix != "" {
		prefix := strings.TrimSuffix(ns.PathPrefix, "/")
		key = prefix + "/" + key
	}
	return fmt.Sprintf("%s/%s/%s", ns.TenantID, ns.ID, key)
}

func (s *StorageService) buildVersionedStorageKey(ns *model.Namespace, key, versionID string) string {
	base := s.buildStorageKey(ns, key)
	versionID = strings.TrimSpace(versionID)
	if versionID == "" {
		return base
	}
	return fmt.Sprintf("%s.__v_%s", base, versionID)
}

func newVersionID() string {
	return fmt.Sprintf("%d", time.Now().UTC().UnixNano())
}

func marshalMetadata(metadata map[string]string) string {
	if len(metadata) == 0 {
		return ""
	}
	b, err := json.Marshal(metadata)
	if err != nil {
		return ""
	}
	return string(b)
}

type CreateStorageConfigRequest struct {
	Name        string `json:"name" binding:"required"`
	Provider    string `json:"provider" binding:"required"`
	Endpoint    string `json:"endpoint"`
	Region      string `json:"region"`
	Bucket      string `json:"bucket" binding:"required"`
	AccessKey   string `json:"access_key"`
	SecretKey   string `json:"secret_key"`
	PathStyle   bool   `json:"path_style"`
	IsDefault   bool   `json:"is_default"`
	ExtraConfig string `json:"extra_config"`
}

type PutObjectRequest struct {
	NamespaceID string            `json:"namespace_id" binding:"required"`
	Key         string            `json:"key" binding:"required"`
	ContentType string            `json:"content_type"`
	Metadata    map[string]string `json:"metadata"`
}

type ListObjectRequest struct {
	NamespaceID string `form:"namespace_id" binding:"required"`
	Prefix      string `form:"prefix"`
	Page        int    `form:"page"`
	PageSize    int    `form:"page_size"`
}
