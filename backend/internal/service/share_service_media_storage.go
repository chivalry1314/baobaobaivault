package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
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
		return nil, err
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
			return s.storageService.DeleteObject(ctx, namespaceID, key)
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
