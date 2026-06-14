package service

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

const (
	shareSiteBrandingSettingsSingleton = "default"
	shareSiteBrandingLogoMaxBytes      = 5 * 1024 * 1024
	shareSiteBrandingLogoNamespaceName = "share-site-branding"
	shareSiteBrandingLogoObjectKey     = "site-branding/logo"
	shareSiteBrandingCacheTTL          = 5 * time.Second
)

func defaultShareSiteBrandingSettingsView() ShareSiteBrandingSettingsView {
	return ShareSiteBrandingSettingsView{
		SiteName:             "Dreamy Card Gallery",
		SiteShortName:        "Dreamy",
		SiteDescription:      "Storefront for browsing and redeeming shared cards.",
		SiteSubtitle:         "Card Gallery",
		ShowSiteSubtitle:     true,
		AuthSubtitle:         "Dreamy Card Gallery account",
		ShowAuthSubtitle:     true,
		LogoText:             "DR",
		LogoBadgeText:        "",
		LogoImageSrc:         "",
		LogoOriginalFileName: "",
		LogoMimeType:         "",
		FooterText:           "(c) 2026 Dreamy Card Gallery",
		DefaultDisplayName:   "Dreamy Card Gallery",
		DefaultCreatorName:   "Dreamy Creator",
		DefaultCreatorHandle: "@dreamy",
		DefaultInitials:      "DR",
		CreatorTagline:       "Show your work in Dreamy and let more people discover your ideas.",
		CanUpdate:            false,
	}
}

func normalizeShareSiteBrandingSettingsView(input ShareSiteBrandingSettingsView) ShareSiteBrandingSettingsView {
	defaults := defaultShareSiteBrandingSettingsView()
	next := ShareSiteBrandingSettingsView{
		SiteName:             strings.TrimSpace(input.SiteName),
		SiteShortName:        strings.TrimSpace(input.SiteShortName),
		SiteDescription:      strings.TrimSpace(input.SiteDescription),
		SiteSubtitle:         strings.TrimSpace(input.SiteSubtitle),
		ShowSiteSubtitle:     input.ShowSiteSubtitle,
		AuthSubtitle:         strings.TrimSpace(input.AuthSubtitle),
		ShowAuthSubtitle:     input.ShowAuthSubtitle,
		LogoText:             strings.TrimSpace(input.LogoText),
		LogoBadgeText:        strings.TrimSpace(input.LogoBadgeText),
		LogoImageSrc:         strings.TrimSpace(input.LogoImageSrc),
		LogoOriginalFileName: strings.TrimSpace(input.LogoOriginalFileName),
		LogoMimeType:         strings.TrimSpace(strings.ToLower(input.LogoMimeType)),
		FooterText:           strings.TrimSpace(input.FooterText),
		DefaultDisplayName:   strings.TrimSpace(input.DefaultDisplayName),
		DefaultCreatorName:   strings.TrimSpace(input.DefaultCreatorName),
		DefaultCreatorHandle: strings.TrimSpace(input.DefaultCreatorHandle),
		DefaultInitials:      strings.TrimSpace(strings.ToUpper(input.DefaultInitials)),
		CreatorTagline:       strings.TrimSpace(input.CreatorTagline),
		CanUpdate:            input.CanUpdate,
	}

	if next.SiteName == "" {
		next.SiteName = defaults.SiteName
	}
	if next.SiteShortName == "" {
		next.SiteShortName = defaults.SiteShortName
	}
	if next.SiteDescription == "" {
		next.SiteDescription = defaults.SiteDescription
	}
	if next.SiteSubtitle == "" {
		next.SiteSubtitle = defaults.SiteSubtitle
	}
	if next.AuthSubtitle == "" {
		next.AuthSubtitle = next.SiteName + " account"
	}
	if next.LogoText == "" {
		next.LogoText = fallbackBrandInitials(next.SiteShortName)
	}
	if next.FooterText == "" {
		next.FooterText = "(c) 2026 " + next.SiteName
	}
	if next.DefaultDisplayName == "" {
		next.DefaultDisplayName = next.SiteName
	}
	if next.DefaultCreatorName == "" {
		next.DefaultCreatorName = next.SiteShortName + " Creator"
	}
	if next.DefaultCreatorHandle == "" {
		next.DefaultCreatorHandle = "@" + strings.ToLower(strings.ReplaceAll(next.SiteShortName, " ", ""))
	}
	if next.DefaultInitials == "" {
		next.DefaultInitials = fallbackBrandInitials(next.SiteShortName)
	}
	if next.CreatorTagline == "" {
		next.CreatorTagline = "Show your work in " + next.SiteShortName + " and let more people discover your ideas."
	}

	return next
}

func fallbackBrandInitials(value string) string {
	clean := strings.TrimSpace(strings.ReplaceAll(value, " ", ""))
	if clean == "" {
		return "CS"
	}
	runes := []rune(clean)
	if len(runes) == 1 {
		return strings.ToUpper(string(runes[0]))
	}
	return strings.ToUpper(string(runes[:2]))
}

func (s *ShareService) currentShareSiteBrandingSettings() ShareSiteBrandingSettingsView {
	s.shareSiteBrandMu.RLock()
	defer s.shareSiteBrandMu.RUnlock()
	return s.shareSiteBrandCfg
}

func (s *ShareService) setShareSiteBrandingSettings(cfg ShareSiteBrandingSettingsView) {
	s.shareSiteBrandMu.Lock()
	s.shareSiteBrandCfg = cfg
	s.shareSiteBrandLoadedAt = time.Now().UTC()
	s.shareSiteBrandMu.Unlock()
}

func (s *ShareService) loadShareSiteBrandingSettingsFromDB() {
	if s == nil || s.db == nil {
		return
	}

	s.shareSiteBrandMu.RLock()
	if !s.shareSiteBrandLoadedAt.IsZero() && time.Since(s.shareSiteBrandLoadedAt) < shareSiteBrandingCacheTTL {
		s.shareSiteBrandMu.RUnlock()
		return
	}
	s.shareSiteBrandMu.RUnlock()

	var settings model.ShareSiteBrandingSettings
	if err := s.db.Where("singleton = ?", shareSiteBrandingSettingsSingleton).First(&settings).Error; err != nil {
		return
	}

	s.setShareSiteBrandingSettings(normalizeShareSiteBrandingSettingsView(ShareSiteBrandingSettingsView{
		SiteName:             settings.SiteName,
		SiteShortName:        settings.SiteShortName,
		SiteDescription:      settings.SiteDescription,
		SiteSubtitle:         settings.SiteSubtitle,
		ShowSiteSubtitle:     settings.ShowSiteSubtitle,
		AuthSubtitle:         settings.AuthSubtitle,
		ShowAuthSubtitle:     settings.ShowAuthSubtitle,
		LogoText:             settings.LogoText,
		LogoBadgeText:        settings.LogoBadgeText,
		LogoImageSrc:         s.resolveShareSiteBrandingLogoURL(&settings),
		LogoOriginalFileName: settings.LogoOriginalFileName,
		LogoMimeType:         settings.LogoMimeType,
		FooterText:           settings.FooterText,
		DefaultDisplayName:   settings.DefaultDisplayName,
		DefaultCreatorName:   settings.DefaultCreatorName,
		DefaultCreatorHandle: settings.DefaultCreatorHandle,
		DefaultInitials:      settings.DefaultInitials,
		CreatorTagline:       settings.CreatorTagline,
	}))
}

func (s *ShareService) GetShareSiteBrandingSettings(ctx context.Context, operatorID string) (*ShareSiteBrandingSettingsView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}
	s.loadShareSiteBrandingSettingsFromDB()
	cfg := s.currentShareSiteBrandingSettings()
	cfg.CanUpdate = s.isConfiguredShareSuperAdminUserID(ctx, operatorID)
	return &cfg, nil
}

func (s *ShareService) GetSharePublicSiteBrandingSettings() ShareSiteBrandingSettingsView {
	s.loadShareSiteBrandingSettingsFromDB()
	cfg := s.currentShareSiteBrandingSettings()
	cfg.CanUpdate = false
	return cfg
}

func (s *ShareService) UpdateShareSiteBrandingSettings(ctx context.Context, input ShareUpdateSiteBrandingSettingsInput) (*ShareSiteBrandingSettingsView, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	if operatorID == "" {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return nil, err
	}

	current, err := s.getOrCreateShareSiteBrandingRecord(ctx)
	if err != nil {
		return nil, err
	}

	next := normalizeShareSiteBrandingSettingsView(ShareSiteBrandingSettingsView{
		SiteName:             input.SiteName,
		SiteShortName:        input.SiteShortName,
		SiteDescription:      input.SiteDescription,
		SiteSubtitle:         input.SiteSubtitle,
		ShowSiteSubtitle:     input.ShowSiteSubtitle,
		AuthSubtitle:         input.AuthSubtitle,
		ShowAuthSubtitle:     input.ShowAuthSubtitle,
		LogoText:             input.LogoText,
		LogoBadgeText:        input.LogoBadgeText,
		LogoImageSrc:         input.LogoImageSrc,
		LogoOriginalFileName: firstNonEmpty(input.LogoOriginalFileName, current.LogoOriginalFileName),
		LogoMimeType:         firstNonEmpty(input.LogoMimeType, current.LogoMimeType),
		FooterText:           input.FooterText,
		DefaultDisplayName:   input.DefaultDisplayName,
		DefaultCreatorName:   input.DefaultCreatorName,
		DefaultCreatorHandle: input.DefaultCreatorHandle,
		DefaultInitials:      input.DefaultInitials,
		CreatorTagline:       input.CreatorTagline,
		CanUpdate:            true,
	})

	record := *current
	record.SiteName = next.SiteName
	record.SiteShortName = next.SiteShortName
	record.SiteDescription = next.SiteDescription
	record.SiteSubtitle = next.SiteSubtitle
	record.ShowSiteSubtitle = next.ShowSiteSubtitle
	record.AuthSubtitle = next.AuthSubtitle
	record.ShowAuthSubtitle = next.ShowAuthSubtitle
	record.LogoText = next.LogoText
	record.LogoBadgeText = next.LogoBadgeText
	record.LogoImageSrc = next.LogoImageSrc
	record.LogoOriginalFileName = next.LogoOriginalFileName
	record.LogoMimeType = next.LogoMimeType
	record.FooterText = next.FooterText
	record.DefaultDisplayName = next.DefaultDisplayName
	record.DefaultCreatorName = next.DefaultCreatorName
	record.DefaultCreatorHandle = next.DefaultCreatorHandle
	record.DefaultInitials = next.DefaultInitials
	record.CreatorTagline = next.CreatorTagline
	if hasShareStoredMedia(record.LogoStorageBackend, record.LogoStorageNamespaceID, record.LogoStorageObjectKey, record.LogoStoredFileName) &&
		strings.HasPrefix(strings.TrimSpace(next.LogoImageSrc), s.shareSiteBrandingLogoPublicPath()) {
		record.LogoImageSrc = s.resolveShareSiteBrandingLogoURL(&record)
	}

	if err := s.db.WithContext(ctx).Save(&record).Error; err != nil {
		return nil, err
	}

	s.setShareSiteBrandingSettings(next)
	return &next, nil
}

func (s *ShareService) UploadShareSiteBrandingLogo(ctx context.Context, input ShareUploadSiteBrandingLogoInput) (*ShareSiteBrandingSettingsView, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	if operatorID == "" {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return nil, err
	}
	if input.FileReader == nil || strings.TrimSpace(input.FileName) == "" {
		return nil, ErrShareFileRequired
	}

	contentType := detectUploadMimeType(input.FileName, input.MimeType)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, ErrShareInvalidImageData
	}

	record, err := s.getOrCreateShareSiteBrandingRecord(ctx)
	if err != nil {
		return nil, err
	}

	if input.MaxFileSize <= 0 {
		input.MaxFileSize = shareSiteBrandingLogoMaxBytes
	}
	if input.MaxFileSize > shareSiteBrandingLogoMaxBytes {
		input.MaxFileSize = shareSiteBrandingLogoMaxBytes
	}

	stored, err := s.storeShareSiteBrandingLogo(ctx, input.FileName, contentType, input.FileReader, input.MaxFileSize)
	if err != nil {
		return nil, err
	}

	if hasShareStoredMedia(record.LogoStorageBackend, record.LogoStorageNamespaceID, record.LogoStorageObjectKey, record.LogoStoredFileName) {
		_ = s.deleteCardStoredMedia(
			ctx,
			shareSiteBrandingSettingsSingleton,
			record.LogoStorageBackend,
			record.LogoStorageNamespaceID,
			record.LogoStorageObjectKey,
			record.LogoStoredFileName,
		)
	}

	record.LogoStorageBackend = stored.StorageBackend
	record.LogoStorageNamespaceID = normalizeOptionalID(stored.StorageNamespaceID)
	record.LogoStorageObjectKey = stored.StorageObjectKey
	record.LogoStorageVersionID = stored.StorageVersionID
	record.LogoStoredFileName = stored.StoredFileName
	record.LogoOriginalFileName = strings.TrimSpace(input.FileName)
	record.LogoMimeType = contentType
	record.LogoImageSrc = s.resolveShareSiteBrandingLogoURL(record)

	if err := s.db.WithContext(ctx).Save(&record).Error; err != nil {
		_ = s.deleteCardStoredMedia(
			ctx,
			shareSiteBrandingSettingsSingleton,
			stored.StorageBackend,
			stored.StorageNamespaceID,
			stored.StorageObjectKey,
			stored.StoredFileName,
		)
		return nil, err
	}

	next := normalizeShareSiteBrandingSettingsView(ShareSiteBrandingSettingsView{
		SiteName:             record.SiteName,
		SiteShortName:        record.SiteShortName,
		SiteDescription:      record.SiteDescription,
		SiteSubtitle:         record.SiteSubtitle,
		ShowSiteSubtitle:     record.ShowSiteSubtitle,
		AuthSubtitle:         record.AuthSubtitle,
		ShowAuthSubtitle:     record.ShowAuthSubtitle,
		LogoText:             record.LogoText,
		LogoBadgeText:        record.LogoBadgeText,
		LogoImageSrc:         record.LogoImageSrc,
		LogoOriginalFileName: record.LogoOriginalFileName,
		LogoMimeType:         record.LogoMimeType,
		FooterText:           record.FooterText,
		DefaultDisplayName:   record.DefaultDisplayName,
		DefaultCreatorName:   record.DefaultCreatorName,
		DefaultCreatorHandle: record.DefaultCreatorHandle,
		DefaultInitials:      record.DefaultInitials,
		CreatorTagline:       record.CreatorTagline,
		CanUpdate:            true,
	})
	s.setShareSiteBrandingSettings(next)
	return &next, nil
}

func (s *ShareService) OpenShareSiteBrandingLogo(ctx context.Context) (*shareStoredMediaStream, string, string, error) {
	record, err := s.getOrCreateShareSiteBrandingRecord(ctx)
	if err != nil {
		return nil, "", "", err
	}
	if !hasShareStoredMedia(record.LogoStorageBackend, record.LogoStorageNamespaceID, record.LogoStorageObjectKey, record.LogoStoredFileName) {
		return nil, "", "", errors.New("object not found")
	}

	stream, err := s.openCardStoredMedia(
		ctx,
		shareSiteBrandingSettingsSingleton,
		record.LogoStorageBackend,
		record.LogoStorageNamespaceID,
		record.LogoStorageObjectKey,
		record.LogoStoredFileName,
	)
	if err != nil {
		return nil, "", "", err
	}

	fileName := strings.TrimSpace(record.LogoOriginalFileName)
	if fileName == "" {
		fileName = "site-logo"
	}
	mimeType := detectUploadMimeType(fileName, record.LogoMimeType)
	return stream, fileName, mimeType, nil
}

func (s *ShareService) shareSiteBrandingLogoPublicPath() string {
	return "/api/share/discover/site-branding/logo"
}

func (s *ShareService) resolveShareSiteBrandingLogoURL(record *model.ShareSiteBrandingSettings) string {
	if record == nil {
		return ""
	}
	if !hasShareStoredMedia(record.LogoStorageBackend, record.LogoStorageNamespaceID, record.LogoStorageObjectKey, record.LogoStoredFileName) {
		return strings.TrimSpace(record.LogoImageSrc)
	}

	base := s.shareSiteBrandingLogoPublicPath()
	token := firstNonEmpty(record.LogoStorageVersionID, record.LogoStoredFileName)
	if token == "" {
		return base
	}
	return base + "?v=" + token
}

func (s *ShareService) getOrCreateShareSiteBrandingRecord(ctx context.Context) (*model.ShareSiteBrandingSettings, error) {
	var record model.ShareSiteBrandingSettings
	err := s.db.WithContext(ctx).Where("singleton = ?", shareSiteBrandingSettingsSingleton).First(&record).Error
	if err == nil {
		return &record, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) && !strings.Contains(strings.ToLower(err.Error()), "record not found") {
		return nil, err
	}

	defaults := normalizeShareSiteBrandingSettingsView(defaultShareSiteBrandingSettingsView())
	record = model.ShareSiteBrandingSettings{
		Singleton:            shareSiteBrandingSettingsSingleton,
		SiteName:             defaults.SiteName,
		SiteShortName:        defaults.SiteShortName,
		SiteDescription:      defaults.SiteDescription,
		SiteSubtitle:         defaults.SiteSubtitle,
		ShowSiteSubtitle:     defaults.ShowSiteSubtitle,
		AuthSubtitle:         defaults.AuthSubtitle,
		ShowAuthSubtitle:     defaults.ShowAuthSubtitle,
		LogoText:             defaults.LogoText,
		LogoBadgeText:        defaults.LogoBadgeText,
		LogoImageSrc:         defaults.LogoImageSrc,
		LogoOriginalFileName: defaults.LogoOriginalFileName,
		LogoMimeType:         defaults.LogoMimeType,
		FooterText:           defaults.FooterText,
		DefaultDisplayName:   defaults.DefaultDisplayName,
		DefaultCreatorName:   defaults.DefaultCreatorName,
		DefaultCreatorHandle: defaults.DefaultCreatorHandle,
		DefaultInitials:      defaults.DefaultInitials,
		CreatorTagline:       defaults.CreatorTagline,
	}
	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *ShareService) ensureShareSiteBrandingLogoNamespace(ctx context.Context) (string, error) {
	if s.storageService == nil {
		return "", ErrShareSaveFileFailed
	}

	var namespace model.Namespace
	err := s.db.WithContext(ctx).
		Where("owner_user_id IS NULL AND name = ?", shareSiteBrandingLogoNamespaceName).
		First(&namespace).Error
	if err == nil {
		return namespace.ID, nil
	}
	if !strings.Contains(strings.ToLower(err.Error()), "record not found") {
		return "", err
	}

	items, listErr := s.storageService.ListStorageConfigs(ctx)
	if listErr != nil {
		return "", listErr
	}
	defaultConfigID := ""
	for _, item := range items {
		if item != nil && item.IsDefault && item.OwnerUserID == nil {
			defaultConfigID = item.ID
			break
		}
	}

	namespace = model.Namespace{
		Name:            shareSiteBrandingLogoNamespaceName,
		Description:     "Public site branding assets",
		Status:          "active",
		PathPrefix:      "share/site-branding",
		StorageConfigID: normalizeOptionalID(stringPtr(defaultConfigID)),
	}
	if err := s.db.WithContext(ctx).Create(&namespace).Error; err != nil {
		return "", err
	}
	return namespace.ID, nil
}

func (s *ShareService) storeShareSiteBrandingLogo(
	ctx context.Context,
	fileName string,
	mimeType string,
	reader io.Reader,
	maxFileSize int64,
) (*shareStoredMediaResult, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(mimeType)), "image/") {
		return nil, ErrShareInvalidImageData
	}

	tempFile, size, err := copyReaderToTempFile(reader, maxFileSize)
	if err != nil {
		if errors.Is(err, ErrShareFileTooLarge) {
			return nil, ErrShareImageTooLarge
		}
		if errors.Is(err, ErrShareFileRequired) {
			return nil, ErrShareInvalidImageData
		}
		return nil, ErrShareSaveFileFailed
	}
	defer func() {
		_ = os.Remove(tempFile.Name())
		_ = tempFile.Close()
	}()

	namespaceID, namespaceErr := s.ensureShareSiteBrandingLogoNamespace(ctx)
	if namespaceErr == nil && namespaceID != "" && s.storageService != nil {
		if _, seekErr := tempFile.Seek(0, io.SeekStart); seekErr == nil {
			object, storeErr := s.storageService.PutObject(
				ctx,
				namespaceID,
				shareSiteBrandingLogoObjectKey,
				tempFile,
				size,
				mimeType,
				nil,
			)
			if storeErr == nil {
				return &shareStoredMediaResult{
					StorageBackend:     model.ShareMediaStorageModeObjectStorage,
					StorageNamespaceID: stringPtr(namespaceID),
					StorageObjectKey:   shareSiteBrandingLogoObjectKey,
					StorageVersionID:   strings.TrimSpace(object.VersionID),
					StoredFileName:     "",
					Size:               size,
				}, nil
			}
		}
	}

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, ErrShareSaveFileFailed
	}
	stored, err := s.storeCardMediaToLocal(shareSiteBrandingSettingsSingleton, fileName, tempFile, size)
	if err != nil {
		if errors.Is(err, ErrShareFileTooLarge) {
			return nil, ErrShareImageTooLarge
		}
		return nil, err
	}
	return stored, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}
