package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
)

const shareMediaStorageSettingsSingleton = "default"

type shareStoredMediaResult struct {
	StorageBackend    string
	StorageNamespaceID *string
	StorageObjectKey  string
	StorageVersionID  string
	StoredFileName    string
	Size              int64
}

type shareStoredMediaStream struct {
	Reader io.ReadCloser
	Size   int64
}

func defaultShareMediaStorageSettingsView() ShareMediaStorageSettingsView {
	return ShareMediaStorageSettingsView{
		StorageMode:          model.ShareMediaStorageModeLocal,
		LocalFallbackEnabled: true,
		CoverNamespaceID:     "",
		AssetNamespaceID:     "",
		CanUpdate:            false,
	}
}

func normalizeShareMediaStorageMode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == model.ShareMediaStorageModeObjectStorage {
		return model.ShareMediaStorageModeObjectStorage
	}
	return model.ShareMediaStorageModeLocal
}

func normalizeShareMediaStorageBackend(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == model.ShareMediaStorageModeObjectStorage {
		return model.ShareMediaStorageModeObjectStorage
	}
	return model.ShareMediaStorageModeLocal
}

func hasShareStoredMedia(storageBackend string, storageNamespaceID *string, storageObjectKey string, storedFileName string) bool {
	backend := normalizeShareMediaStorageBackend(storageBackend)
	if backend == model.ShareMediaStorageModeObjectStorage {
		return strings.TrimSpace(derefString(storageNamespaceID)) != "" && strings.TrimSpace(storageObjectKey) != ""
	}
	return strings.TrimSpace(storedFileName) != ""
}

func (s *ShareService) currentShareMediaStorageSettings() ShareMediaStorageSettingsView {
	s.shareMediaCfgMu.RLock()
	defer s.shareMediaCfgMu.RUnlock()
	return s.shareMediaCfg
}

func (s *ShareService) setShareMediaStorageSettings(cfg ShareMediaStorageSettingsView) {
	s.shareMediaCfgMu.Lock()
	s.shareMediaCfg = cfg
	s.shareMediaCfgMu.Unlock()
}

func (s *ShareService) loadShareMediaStorageSettingsFromDB() {
	if s == nil || s.db == nil {
		return
	}

	var settings model.ShareMediaStorageSettings
	if err := s.db.Where("singleton = ?", shareMediaStorageSettingsSingleton).First(&settings).Error; err != nil {
		return
	}

	s.setShareMediaStorageSettings(ShareMediaStorageSettingsView{
		StorageMode:          normalizeShareMediaStorageMode(settings.StorageMode),
		LocalFallbackEnabled: settings.LocalFallbackEnabled,
		CoverNamespaceID:     strings.TrimSpace(derefString(settings.CoverNamespaceID)),
		AssetNamespaceID:     strings.TrimSpace(derefString(settings.AssetNamespaceID)),
		CanUpdate:            false,
	})
}

func (s *ShareService) GetShareMediaStorageSettings(ctx context.Context, operatorID string) (*ShareMediaStorageSettingsView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}
	cfg := s.currentShareMediaStorageSettings()
	cfg.CanUpdate = s.isConfiguredShareSuperAdminUserID(ctx, operatorID)
	return &cfg, nil
}

func (s *ShareService) GetSharePublicMediaStorageSettings() map[string]string {
	cfg := s.currentShareMediaStorageSettings()
	return map[string]string{"storage_mode": cfg.StorageMode}
}

func (s *ShareService) GetShareMediaStorageMigrationPlan(ctx context.Context, operatorID string) (*ShareMediaStorageMigrationPlanView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	cfg := s.currentShareMediaStorageSettings()
	summary, err := s.collectShareMediaMigrationSummary(ctx)
	if err != nil {
		return nil, err
	}

	return &ShareMediaStorageMigrationPlanView{
		StorageMode:          cfg.StorageMode,
		LocalFallbackEnabled: cfg.LocalFallbackEnabled,
		CoverNamespaceID:     cfg.CoverNamespaceID,
		AssetNamespaceID:     cfg.AssetNamespaceID,
		CanMigrate: s.isConfiguredShareSuperAdminUserID(ctx, operatorID) &&
			cfg.StorageMode == model.ShareMediaStorageModeObjectStorage &&
			cfg.CoverNamespaceID != "" &&
			cfg.AssetNamespaceID != "" &&
			s.storageService != nil,
		Summary:              summary,
	}, nil
}

func (s *ShareService) UpdateShareMediaStorageSettings(ctx context.Context, input ShareUpdateMediaStorageSettingsInput) (*ShareMediaStorageSettingsView, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	if operatorID == "" {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return nil, err
	}

	next := ShareMediaStorageSettingsView{
		StorageMode:          normalizeShareMediaStorageMode(input.StorageMode),
		LocalFallbackEnabled: input.LocalFallbackEnabled,
		CoverNamespaceID:     strings.TrimSpace(input.CoverNamespaceID),
		AssetNamespaceID:     strings.TrimSpace(input.AssetNamespaceID),
		CanUpdate:            true,
	}

	if next.StorageMode == model.ShareMediaStorageModeObjectStorage {
		if next.CoverNamespaceID == "" || next.AssetNamespaceID == "" {
			return nil, errors.New("cover_namespace_id and asset_namespace_id are required")
		}
		if err := s.ensureShareNamespaceExists(ctx, next.CoverNamespaceID); err != nil {
			return nil, err
		}
		if err := s.ensureShareNamespaceExists(ctx, next.AssetNamespaceID); err != nil {
			return nil, err
		}
	}

	record := model.ShareMediaStorageSettings{
		Singleton:            shareMediaStorageSettingsSingleton,
		StorageMode:          next.StorageMode,
		LocalFallbackEnabled: next.LocalFallbackEnabled,
		CoverNamespaceID:     normalizeOptionalID(stringPtr(next.CoverNamespaceID)),
		AssetNamespaceID:     normalizeOptionalID(stringPtr(next.AssetNamespaceID)),
	}

	if err := s.db.WithContext(ctx).
		Where("singleton = ?", shareMediaStorageSettingsSingleton).
		Assign(record).
		FirstOrCreate(&record).Error; err != nil {
		return nil, err
	}

	s.setShareMediaStorageSettings(next)
	return &next, nil
}

func (s *ShareService) RunShareMediaStorageMigration(ctx context.Context, input ShareMediaStorageMigrationRunInput) (*ShareMediaStorageMigrationRunResult, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	if operatorID == "" {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return nil, err
	}

	cfg := s.currentShareMediaStorageSettings()
	if cfg.StorageMode != model.ShareMediaStorageModeObjectStorage {
		return nil, errors.New("share media storage mode must be object_storage")
	}
	if s.storageService == nil {
		return nil, errors.New("object storage service is unavailable")
	}
	if cfg.CoverNamespaceID == "" || cfg.AssetNamespaceID == "" {
		return nil, errors.New("cover_namespace_id and asset_namespace_id are required")
	}

	batchSize := input.BatchSize
	if batchSize <= 0 {
		batchSize = 20
	}
	if batchSize > 200 {
		batchSize = 200
	}

	items, err := s.loadShareMediaMigrationItems(ctx, batchSize)
	if err != nil {
		return nil, err
	}

	result := &ShareMediaStorageMigrationRunResult{
		DeleteLocal: input.DeleteLocal,
		Messages:    []string{},
	}

	for _, item := range items {
		result.Processed++
		if strings.TrimSpace(item.StoredFileName) == "" {
			result.Skipped++
			result.Messages = append(result.Messages, fmt.Sprintf("%s %s 没有本地文件名，已跳过", item.KindLabel, item.ResourceID))
			continue
		}

		path := s.getStoredFilePath(item.CreatorID, item.StoredFileName)
		file, err := os.Open(path)
		if err != nil {
			if os.IsNotExist(err) {
				result.Skipped++
				if input.IncludeMissing {
					result.Messages = append(result.Messages, fmt.Sprintf("%s %s 的本地文件不存在：%s", item.KindLabel, item.ResourceID, item.StoredFileName))
				}
				continue
			}
			result.Failed++
			result.Messages = append(result.Messages, fmt.Sprintf("%s %s 打开本地文件失败：%v", item.KindLabel, item.ResourceID, err))
			continue
		}

		stored, migrateErr := func() (*shareStoredMediaResult, error) {
			defer file.Close()
			if item.Kind == shareMediaMigrationKindCover {
				return s.storeCardMediaToObjectStorage(
					ctx,
					cfg.CoverNamespaceID,
					s.buildCardCoverObjectKey(item.CreatorID, item.CardID),
					item.OriginalFileName,
					item.MimeType,
					file,
					item.Size,
				)
			}
			return s.storeCardMediaToObjectStorage(
				ctx,
				cfg.AssetNamespaceID,
				s.buildCardAssetObjectKey(item.CreatorID, item.CardID, item.Slot),
				item.OriginalFileName,
				item.MimeType,
				file,
				item.Size,
			)
		}()
		if migrateErr != nil {
			result.Failed++
			result.Messages = append(result.Messages, fmt.Sprintf("%s %s 上传到对象存储失败：%v", item.KindLabel, item.ResourceID, migrateErr))
			continue
		}

		if err := s.persistShareMediaMigrationResult(ctx, item, stored, input.DeleteLocal); err != nil {
			_ = s.deleteCardStoredMedia(ctx, item.CreatorID, stored.StorageBackend, stored.StorageNamespaceID, stored.StorageObjectKey, stored.StoredFileName)
			result.Failed++
			result.Messages = append(result.Messages, fmt.Sprintf("%s %s 更新数据库失败：%v", item.KindLabel, item.ResourceID, err))
			continue
		}

		if input.DeleteLocal {
			if err := s.removeStoredFile(item.CreatorID, item.StoredFileName); err != nil {
				result.Messages = append(result.Messages, fmt.Sprintf("%s %s 已迁移，但删除本地文件失败：%v", item.KindLabel, item.ResourceID, err))
			}
		}

		result.Succeeded++
	}

	summary, err := s.collectShareMediaMigrationSummary(ctx)
	if err != nil {
		return nil, err
	}
	result.Summary = summary
	result.HasMore = summary.TotalPending > 0

	if len(result.Messages) > 30 {
		result.Messages = result.Messages[:30]
		result.Messages = append(result.Messages, "消息过多，已截断显示前 30 条。")
	}

	return result, nil
}

func (s *ShareService) ensureShareNamespaceExists(ctx context.Context, namespaceID string) error {
	namespaceID = strings.TrimSpace(namespaceID)
	if namespaceID == "" {
		return errors.New("namespace id is required")
	}

	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Namespace{}).Where("id = ?", namespaceID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("namespace not found")
	}
	return nil
}

const (
	shareMediaMigrationKindCover = "cover"
	shareMediaMigrationKindAsset = "asset"
)

type shareMediaMigrationItem struct {
	Kind             string
	KindLabel        string
	ResourceID       string
	CardID           string
	CreatorID        string
	Slot             string
	StoredFileName   string
	OriginalFileName string
	MimeType         string
	Size             int64
}

func (s *ShareService) collectShareMediaMigrationSummary(ctx context.Context) (ShareMediaStorageMigrationSummary, error) {
	summary := ShareMediaStorageMigrationSummary{}

	var cards []model.SharePlatformCard
	if err := s.db.WithContext(ctx).
		Select("id", "creator_external_user_id", "storage_backend", "stored_file_name").
		Where("storage_backend = ? AND stored_file_name <> ''", model.ShareMediaStorageModeLocal).
		Find(&cards).Error; err != nil {
		return summary, err
	}
	for _, card := range cards {
		if _, err := os.Stat(s.getStoredFilePath(card.CreatorExternalUserID, card.StoredFileName)); err == nil {
			summary.CoversPending++
		} else if os.IsNotExist(err) {
			summary.CoversMissing++
		} else {
			return summary, err
		}
	}

	var assets []model.SharePlatformCardAsset
	if err := s.db.WithContext(ctx).
		Select("id", "card_id", "storage_backend", "stored_file_name").
		Where("storage_backend = ? AND stored_file_name <> ''", model.ShareMediaStorageModeLocal).
		Find(&assets).Error; err != nil {
		return summary, err
	}
	if len(assets) > 0 {
		cardCreators := make(map[string]string, len(assets))
		cardIDs := make([]string, 0, len(assets))
		seen := make(map[string]struct{}, len(assets))
		for _, asset := range assets {
			if _, ok := seen[asset.CardID]; ok {
				continue
			}
			seen[asset.CardID] = struct{}{}
			cardIDs = append(cardIDs, asset.CardID)
		}

		var assetCards []model.SharePlatformCard
		if err := s.db.WithContext(ctx).
			Select("id", "creator_external_user_id").
			Where("id IN ?", cardIDs).
			Find(&assetCards).Error; err != nil {
			return summary, err
		}
		for _, card := range assetCards {
			cardCreators[card.ID] = card.CreatorExternalUserID
		}

		for _, asset := range assets {
			creatorID := cardCreators[asset.CardID]
			if creatorID == "" {
				summary.AssetsMissing++
				continue
			}
			if _, err := os.Stat(s.getStoredFilePath(creatorID, asset.StoredFileName)); err == nil {
				summary.AssetsPending++
			} else if os.IsNotExist(err) {
				summary.AssetsMissing++
			} else {
				return summary, err
			}
		}
	}

	summary.TotalPending = summary.CoversPending + summary.AssetsPending
	summary.TotalMissing = summary.CoversMissing + summary.AssetsMissing
	return summary, nil
}

func (s *ShareService) loadShareMediaMigrationItems(ctx context.Context, batchSize int) ([]shareMediaMigrationItem, error) {
	items := make([]shareMediaMigrationItem, 0, batchSize)

	var cards []model.SharePlatformCard
	if err := s.db.WithContext(ctx).
		Select("id", "creator_external_user_id", "stored_file_name", "original_file_name", "mime_type", "size", "updated_at").
		Where("storage_backend = ? AND stored_file_name <> ''", model.ShareMediaStorageModeLocal).
		Order("updated_at ASC, created_at ASC").
		Limit(batchSize).
		Find(&cards).Error; err != nil {
		return nil, err
	}

	for _, card := range cards {
		items = append(items, shareMediaMigrationItem{
			Kind:             shareMediaMigrationKindCover,
			KindLabel:        "封面",
			ResourceID:       card.ID,
			CardID:           card.ID,
			CreatorID:        card.CreatorExternalUserID,
			StoredFileName:   card.StoredFileName,
			OriginalFileName: card.OriginalFileName,
			MimeType:         card.MimeType,
			Size:             card.Size,
		})
		if len(items) >= batchSize {
			return items, nil
		}
	}

	remaining := batchSize - len(items)
	if remaining <= 0 {
		return items, nil
	}

	var assets []model.SharePlatformCardAsset
	if err := s.db.WithContext(ctx).
		Select("id", "card_id", "slot", "stored_file_name", "original_file_name", "mime_type", "size", "updated_at").
		Where("storage_backend = ? AND stored_file_name <> ''", model.ShareMediaStorageModeLocal).
		Order("updated_at ASC, created_at ASC").
		Limit(remaining * 2).
		Find(&assets).Error; err != nil {
		return nil, err
	}
	if len(assets) == 0 {
		return items, nil
	}

	cardIDs := make([]string, 0, len(assets))
	cardSeen := make(map[string]struct{}, len(assets))
	for _, asset := range assets {
		if _, ok := cardSeen[asset.CardID]; ok {
			continue
		}
		cardSeen[asset.CardID] = struct{}{}
		cardIDs = append(cardIDs, asset.CardID)
	}

	var assetCards []model.SharePlatformCard
	if err := s.db.WithContext(ctx).
		Select("id", "creator_external_user_id").
		Where("id IN ?", cardIDs).
		Find(&assetCards).Error; err != nil {
		return nil, err
	}
	cardCreators := make(map[string]string, len(assetCards))
	for _, card := range assetCards {
		cardCreators[card.ID] = card.CreatorExternalUserID
	}

	sort.SliceStable(assets, func(i, j int) bool {
		if assets[i].CardID == assets[j].CardID {
			return assets[i].Slot < assets[j].Slot
		}
		return assets[i].CardID < assets[j].CardID
	})

	for _, asset := range assets {
		creatorID := cardCreators[asset.CardID]
		if creatorID == "" {
			continue
		}
		items = append(items, shareMediaMigrationItem{
			Kind:             shareMediaMigrationKindAsset,
			KindLabel:        "附件",
			ResourceID:       asset.ID,
			CardID:           asset.CardID,
			CreatorID:        creatorID,
			Slot:             asset.Slot,
			StoredFileName:   asset.StoredFileName,
			OriginalFileName: asset.OriginalFileName,
			MimeType:         asset.MimeType,
			Size:             asset.Size,
		})
		if len(items) >= batchSize {
			break
		}
	}

	return items, nil
}

func (s *ShareService) persistShareMediaMigrationResult(ctx context.Context, item shareMediaMigrationItem, stored *shareStoredMediaResult, clearLocal bool) error {
	storedFileName := item.StoredFileName
	if clearLocal {
		storedFileName = stored.StoredFileName
	}

	updates := map[string]any{
		"storage_backend":      stored.StorageBackend,
		"storage_namespace_id": normalizeOptionalID(stored.StorageNamespaceID),
		"storage_object_key":   stored.StorageObjectKey,
		"storage_version_id":   stored.StorageVersionID,
		"stored_file_name":     storedFileName,
	}

	switch item.Kind {
	case shareMediaMigrationKindCover:
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Where("id = ?", item.CardID).
			Updates(updates).Error
	case shareMediaMigrationKindAsset:
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCardAsset{}).
			Where("id = ?", item.ResourceID).
			Updates(updates).Error
	default:
		return errors.New("invalid migration item kind")
	}
}

func (s *ShareService) buildCardCoverObjectKey(creatorID, cardID string) string {
	return fmt.Sprintf("cards/%s/%s/cover", filepath.Base(strings.TrimSpace(creatorID)), strings.TrimSpace(cardID))
}

func (s *ShareService) buildCardAssetObjectKey(creatorID, cardID, slot string) string {
	return fmt.Sprintf(
		"cards/%s/%s/slots/%s",
		filepath.Base(strings.TrimSpace(creatorID)),
		strings.TrimSpace(cardID),
		normalizeShareCardSlot(slot),
	)
}

func (s *ShareService) storeCardCoverMedia(
	ctx context.Context,
	creatorID string,
	cardID string,
	fileName string,
	mimeType string,
	reader io.Reader,
	maxFileSize int64,
) (*shareStoredMediaResult, error) {
	cfg := s.currentShareMediaStorageSettings()
	if cfg.StorageMode == model.ShareMediaStorageModeObjectStorage && s.storageService != nil {
		return s.storeCardMediaToObjectStorage(
			ctx,
			cfg.CoverNamespaceID,
			s.buildCardCoverObjectKey(creatorID, cardID),
			fileName,
			mimeType,
			reader,
			maxFileSize,
		)
	}
	return s.storeCardMediaToLocal(creatorID, fileName, reader, maxFileSize)
}

func (s *ShareService) storeCardAssetMedia(
	ctx context.Context,
	creatorID string,
	cardID string,
	slot string,
	fileName string,
	mimeType string,
	reader io.Reader,
	maxFileSize int64,
) (*shareStoredMediaResult, error) {
	cfg := s.currentShareMediaStorageSettings()
	if cfg.StorageMode == model.ShareMediaStorageModeObjectStorage && s.storageService != nil {
		return s.storeCardMediaToObjectStorage(
			ctx,
			cfg.AssetNamespaceID,
			s.buildCardAssetObjectKey(creatorID, cardID, slot),
			fileName,
			mimeType,
			reader,
			maxFileSize,
		)
	}
	return s.storeCardMediaToLocal(creatorID, fileName, reader, maxFileSize)
}

func (s *ShareService) storeCardMediaToLocal(
	creatorID string,
	fileName string,
	reader io.Reader,
	maxFileSize int64,
) (*shareStoredMediaResult, error) {
	storedFileName, size, err := s.saveUploadFile(creatorID, fileName, reader, maxFileSize)
	if err != nil {
		return nil, err
	}

	return &shareStoredMediaResult{
		StorageBackend: model.ShareMediaStorageModeLocal,
		StoredFileName: storedFileName,
		Size:           size,
	}, nil
}

func (s *ShareService) storeCardMediaToObjectStorage(
	ctx context.Context,
	namespaceID string,
	objectKey string,
	fileName string,
	mimeType string,
	reader io.Reader,
	maxFileSize int64,
) (*shareStoredMediaResult, error) {
	namespaceID = strings.TrimSpace(namespaceID)
	if namespaceID == "" || s.storageService == nil {
		return nil, ErrShareSaveFileFailed
	}

	tempFile, size, err := copyReaderToTempFile(reader, maxFileSize)
	if err != nil {
		if errors.Is(err, ErrShareFileTooLarge) || errors.Is(err, ErrShareFileRequired) {
			return nil, err
		}
		return nil, ErrShareSaveFileFailed
	}
	defer func() {
		_ = os.Remove(tempFile.Name())
		_ = tempFile.Close()
	}()

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, ErrShareSaveFileFailed
	}

	contentType := detectUploadMimeType(fileName, mimeType)
	object, err := s.storageService.PutObject(
		ctx,
		namespaceID,
		objectKey,
		tempFile,
		size,
		contentType,
		nil,
	)
	if err != nil {
		if s.logger != nil {
			s.logger.Warn("failed to store card media to object storage",
				zap.String("namespace_id", namespaceID),
				zap.String("object_key", objectKey),
				zap.Int64("size", size),
				zap.Error(err),
			)
		}
		return nil, fmt.Errorf("%w: %v", ErrShareSaveFileFailed, err)
	}

	return &shareStoredMediaResult{
		StorageBackend:    model.ShareMediaStorageModeObjectStorage,
		StorageNamespaceID: stringPtr(namespaceID),
		StorageObjectKey:  objectKey,
		StorageVersionID:  strings.TrimSpace(object.VersionID),
		StoredFileName:    "",
		Size:              size,
	}, nil
}

func (s *ShareService) deleteCardStoredMedia(
	ctx context.Context,
	creatorID string,
	storageBackend string,
	storageNamespaceID *string,
	storageObjectKey string,
	storedFileName string,
) error {
	backend := normalizeShareMediaStorageBackend(storageBackend)
	if backend == model.ShareMediaStorageModeObjectStorage && s.storageService != nil {
		namespaceID := strings.TrimSpace(derefString(storageNamespaceID))
		key := strings.TrimSpace(storageObjectKey)
		if namespaceID != "" && key != "" {
			if err := s.storageService.DeleteObject(ctx, namespaceID, key); err != nil {
				return err
			}
		}
	}

	if strings.TrimSpace(storedFileName) == "" {
		return nil
	}
	return s.removeStoredFile(creatorID, storedFileName)
}

func (s *ShareService) openCardStoredMedia(
	ctx context.Context,
	creatorID string,
	storageBackend string,
	storageNamespaceID *string,
	storageObjectKey string,
	storedFileName string,
) (*shareStoredMediaStream, error) {
	backend := normalizeShareMediaStorageBackend(storageBackend)
	if backend == model.ShareMediaStorageModeObjectStorage && s.storageService != nil {
		namespaceID := strings.TrimSpace(derefString(storageNamespaceID))
		key := strings.TrimSpace(storageObjectKey)
		if namespaceID != "" && key != "" {
			reader, object, err := s.storageService.GetObject(ctx, namespaceID, key)
			if err == nil {
				return &shareStoredMediaStream{
					Reader: reader,
					Size:   object.Size,
				}, nil
			}
			if !s.currentShareMediaStorageSettings().LocalFallbackEnabled || strings.TrimSpace(storedFileName) == "" {
				return nil, err
			}
		}
	}

	path := s.getStoredFilePath(creatorID, storedFileName)
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	return &shareStoredMediaStream{
		Reader: file,
		Size:   stat.Size(),
	}, nil
}

func copyReaderToTempFile(reader io.Reader, maxFileSize int64) (*os.File, int64, error) {
	tempFile, err := os.CreateTemp("", "share-card-media-*")
	if err != nil {
		return nil, 0, err
	}

	success := false
	defer func() {
		if success {
			return
		}
		_ = tempFile.Close()
		_ = os.Remove(tempFile.Name())
	}()

	var source io.Reader = reader
	if maxFileSize > 0 {
		source = io.LimitReader(reader, maxFileSize+1)
	}

	size, err := io.Copy(tempFile, source)
	if err != nil {
		return nil, 0, err
	}
	if maxFileSize > 0 && size > maxFileSize {
		return nil, 0, ErrShareFileTooLarge
	}
	if size <= 0 {
		return nil, 0, ErrShareFileRequired
	}

	success = true
	return tempFile, size, nil
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
