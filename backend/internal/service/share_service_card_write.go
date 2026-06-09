package service

import (
	"context"
	"errors"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"io"
	"path/filepath"
	"strings"
	"time"
)

func (s *ShareService) CreateCard(ctx context.Context, input ShareCreateCardInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if strings.TrimSpace(input.FileName) == "" || input.FileReader == nil {
		return nil, ErrShareFileRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}
	if !isValidShareCardAccessMode(input.AccessMode) {
		return nil, ErrShareInvalidAccessMode
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = model.SharePlatformCardStatusPublished
	}
	status = strings.ToLower(status)
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	var userCount int64
	if err := s.db.WithContext(ctx).Model(&model.ShareExternalUser{}).
		Where("id = ?", strings.TrimSpace(input.CreatorID)).
		Count(&userCount).Error; err != nil {
		return nil, err
	}
	if userCount == 0 {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureShareCreatorRole(ctx, input.CreatorID); err != nil {
		return nil, err
	}

	cardID := randomUUIDLike()
	storedAsset, err := s.storeCardAssetMedia(
		ctx,
		input.CreatorID,
		cardID,
		"system_theme",
		input.FileName,
		input.MimeType,
		input.FileReader,
		input.MaxFileSize,
	)
	if err != nil {
		return nil, err
	}
	coverStoredFileName := ""
	coverFileSize := int64(0)
	coverFileName := ""
	coverMimeType := ""
	var coverStorageNamespaceID *string
	coverStorageObjectKey := ""
	coverStorageVersionID := ""
	coverStorageBackend := model.ShareMediaStorageModeLocal
	if strings.TrimSpace(input.CoverFileName) != "" && input.CoverReader != nil {
		storedCover, coverErr := s.storeCardCoverMedia(
			ctx,
			input.CreatorID,
			cardID,
			input.CoverFileName,
			input.CoverMimeType,
			input.CoverReader,
			input.MaxFileSize,
		)
		err = coverErr
		if err != nil {
			_ = s.deleteCardStoredMedia(ctx, input.CreatorID, storedAsset.StorageBackend, storedAsset.StorageNamespaceID, storedAsset.StorageObjectKey, storedAsset.StoredFileName)
			return nil, err
		}
		coverStoredFileName = storedCover.StoredFileName
		coverFileSize = storedCover.Size
		coverStorageNamespaceID = storedCover.StorageNamespaceID
		coverStorageObjectKey = storedCover.StorageObjectKey
		coverStorageVersionID = storedCover.StorageVersionID
		coverStorageBackend = storedCover.StorageBackend
		coverFileName = filepath.Base(input.CoverFileName)
		coverMimeType = detectUploadMimeType(input.CoverFileName, input.CoverMimeType)
	}

	mimeType := detectUploadMimeType(input.FileName, input.MimeType)

	card := model.SharePlatformCard{
		ID:                     cardID,
		CreatorExternalUserID:  strings.TrimSpace(input.CreatorID),
		Title:                  strings.TrimSpace(input.Title),
		Description:            strings.TrimSpace(input.Description),
		Visibility:             normalizeShareVisibility(input.Visibility),
		Status:                 status,
		AccessMode:             normalizeShareCardAccessMode(input.AccessMode),
		ReviewStatus:           defaultReviewStatusForStatus(status),
		SubmittedAt:            defaultSubmittedAtForReviewStatus(defaultReviewStatusForStatus(status)),
		ReviewedAt:             nil,
		ReviewReason:           "",
		ReviewerExternalUserID: nil,
		StorageBackend:         coverStorageBackend,
		StorageNamespaceID:     coverStorageNamespaceID,
		StorageObjectKey:       coverStorageObjectKey,
		StorageVersionID:       coverStorageVersionID,
		StoredFileName:         coverStoredFileName,
		OriginalFileName:       coverFileName,
		MimeType:               coverMimeType,
		Size:                   coverFileSize,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&card).Error; err != nil {
			return err
		}

		asset := model.SharePlatformCardAsset{
			CardID:           card.ID,
			Slot:             "system_theme",
			StorageBackend:   storedAsset.StorageBackend,
			StorageNamespaceID: storedAsset.StorageNamespaceID,
			StorageObjectKey: storedAsset.StorageObjectKey,
			StorageVersionID: storedAsset.StorageVersionID,
			StoredFileName:   storedAsset.StoredFileName,
			OriginalFileName: filepath.Base(input.FileName),
			MimeType:         mimeType,
			Size:             storedAsset.Size,
			SortOrder:        0,
		}
		if err := tx.Create(&asset).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		_ = s.deleteCardStoredMedia(ctx, input.CreatorID, storedAsset.StorageBackend, storedAsset.StorageNamespaceID, storedAsset.StorageObjectKey, storedAsset.StoredFileName)
		if hasShareStoredMedia(coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName) {
			_ = s.deleteCardStoredMedia(ctx, input.CreatorID, coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName)
		}
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) CreateCardBundle(ctx context.Context, input ShareCreateCardBundleInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}
	if !isValidShareCardAccessMode(input.AccessMode) {
		return nil, ErrShareInvalidAccessMode
	}
	if len(input.Assets) == 0 {
		return nil, ErrShareFileRequired
	}
	if err := validateShareCardSlotItems(input.Assets); err != nil {
		return nil, err
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = model.SharePlatformCardStatusPublished
	}
	status = strings.ToLower(status)
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	creatorID := strings.TrimSpace(input.CreatorID)
	var creator model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&creator, "id = ?", creatorID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}
	if creator.Status != model.ShareExternalUserStatusActive {
		return nil, ErrShareUserNotFound
	}
	if !isShareCreatorRole(creator.Role) {
		return nil, ErrShareForbiddenRole
	}

	type savedAsset struct {
		slot              string
		storageBackend    string
		storageNamespaceID *string
		storageObjectKey  string
		storageVersionID  string
		storedFileName    string
		fileName          string
		mimeType          string
		size              int64
	}

	cardID := randomUUIDLike()
	savedAssets := make([]savedAsset, 0, len(input.Assets))
	coverStoredFileName := ""
	coverFileSize := int64(0)
	coverFileName := ""
	coverMimeType := ""
	var coverStorageNamespaceID *string
	coverStorageObjectKey := ""
	coverStorageVersionID := ""
	coverStorageBackend := model.ShareMediaStorageModeLocal
	var err error
	if strings.TrimSpace(input.CoverFileName) != "" && input.CoverReader != nil {
		storedCover, coverErr := s.storeCardCoverMedia(
			ctx,
			creatorID,
			cardID,
			input.CoverFileName,
			input.CoverMimeType,
			input.CoverReader,
			input.MaxFileSize,
		)
		err = coverErr
		if err != nil {
			return nil, err
		}
		coverStoredFileName = storedCover.StoredFileName
		coverFileSize = storedCover.Size
		coverStorageNamespaceID = storedCover.StorageNamespaceID
		coverStorageObjectKey = storedCover.StorageObjectKey
		coverStorageVersionID = storedCover.StorageVersionID
		coverStorageBackend = storedCover.StorageBackend
		coverFileName = filepath.Base(input.CoverFileName)
		coverMimeType = detectUploadMimeType(input.CoverFileName, input.CoverMimeType)
	}
	for _, item := range input.Assets {
		storedAsset, saveErr := s.storeCardAssetMedia(
			ctx,
			creatorID,
			cardID,
			item.Slot,
			item.FileName,
			item.MimeType,
			item.FileReader,
			input.MaxFileSize,
		)
		err := saveErr
		if err != nil {
			if hasShareStoredMedia(coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName) {
				_ = s.deleteCardStoredMedia(ctx, creatorID, coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName)
			}
			for _, saved := range savedAssets {
				_ = s.deleteCardStoredMedia(ctx, creatorID, saved.storageBackend, saved.storageNamespaceID, saved.storageObjectKey, saved.storedFileName)
			}
			return nil, err
		}

		mimeType := detectUploadMimeType(item.FileName, item.MimeType)
		savedAssets = append(savedAssets, savedAsset{
			slot:              normalizeShareCardSlot(item.Slot),
			storageBackend:    storedAsset.StorageBackend,
			storageNamespaceID: storedAsset.StorageNamespaceID,
			storageObjectKey:  storedAsset.StorageObjectKey,
			storageVersionID:  storedAsset.StorageVersionID,
			storedFileName:    storedAsset.StoredFileName,
			fileName:          filepath.Base(item.FileName),
			mimeType:          mimeType,
			size:              storedAsset.Size,
		})
	}

	card := model.SharePlatformCard{
		ID:                     cardID,
		CreatorExternalUserID:  creatorID,
		Title:                  strings.TrimSpace(input.Title),
		Description:            strings.TrimSpace(input.Description),
		Visibility:             normalizeShareVisibility(input.Visibility),
		Status:                 status,
		AccessMode:             normalizeShareCardAccessMode(input.AccessMode),
		ReviewStatus:           defaultReviewStatusForStatus(status),
		SubmittedAt:            defaultSubmittedAtForReviewStatus(defaultReviewStatusForStatus(status)),
		ReviewedAt:             nil,
		ReviewReason:           "",
		ReviewerExternalUserID: nil,
		StorageBackend:         coverStorageBackend,
		StorageNamespaceID:     coverStorageNamespaceID,
		StorageObjectKey:       coverStorageObjectKey,
		StorageVersionID:       coverStorageVersionID,
		StoredFileName:         coverStoredFileName,
		OriginalFileName:       coverFileName,
		MimeType:               coverMimeType,
		Size:                   coverFileSize,
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&card).Error; err != nil {
			return err
		}
		for index, asset := range savedAssets {
			row := model.SharePlatformCardAsset{
				CardID:             card.ID,
				Slot:               asset.slot,
				StorageBackend:     asset.storageBackend,
				StorageNamespaceID: asset.storageNamespaceID,
				StorageObjectKey:   asset.storageObjectKey,
				StorageVersionID:   asset.storageVersionID,
				StoredFileName:     asset.storedFileName,
				OriginalFileName:   asset.fileName,
				MimeType:           asset.mimeType,
				Size:               asset.size,
				SortOrder:          index,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		if hasShareStoredMedia(coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName) {
			_ = s.deleteCardStoredMedia(ctx, creatorID, coverStorageBackend, coverStorageNamespaceID, coverStorageObjectKey, coverStoredFileName)
		}
		for _, saved := range savedAssets {
			_ = s.deleteCardStoredMedia(ctx, creatorID, saved.storageBackend, saved.storageNamespaceID, saved.storageObjectKey, saved.storedFileName)
		}
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) UpdateCardByOwner(ctx context.Context, input ShareUpdateCardInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}
	if !isValidShareCardAccessMode(input.AccessMode) {
		return nil, ErrShareInvalidAccessMode
	}

	status := strings.ToLower(strings.TrimSpace(input.Status))
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(input.CardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != strings.TrimSpace(input.OwnerID) {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}

		nextTitle := strings.TrimSpace(input.Title)
		nextDescription := strings.TrimSpace(input.Description)
		nextVisibility := normalizeShareVisibility(input.Visibility)
		shouldResetReview := card.Title != nextTitle ||
			card.Description != nextDescription ||
			card.Visibility != nextVisibility ||
			card.Status != status

		card.Title = nextTitle
		card.Description = nextDescription
		card.Visibility = nextVisibility
		card.Status = status
		if strings.TrimSpace(input.AccessMode) != "" {
			card.AccessMode = normalizeShareCardAccessMode(input.AccessMode)
			if card.AccessMode == model.SharePlatformCardAccessModeFree {
				card.AccessCode = ""
				card.AccessCodeExpiresAt = nil
				card.AccessCodeUsageLimit = 0
				card.AccessCodeUsageCount = 0
			}
		}
		if shouldResetReview && card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			now := time.Now().UTC()
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
		} else if shouldResetReview {
			card.ReviewStatus = model.SharePlatformCardReviewStatusUnsubmitted
			card.SubmittedAt = nil
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}
		if shouldResetReview {
			card.ReviewReason = ""
		}
		card.UpdatedAt = time.Now().UTC()

		if err := tx.Save(&card).Error; err != nil {
			return err
		}
		updated = card
		return nil
	})
	if err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{updated.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&updated, assetsByCardID[updated.ID])
	return &view, nil
}

func (s *ShareService) ReplaceCardAssetByOwner(ctx context.Context, input ShareUpdateCardAssetInput) (*ShareCardDetail, error) {
	ownerID := strings.TrimSpace(input.OwnerID)
	cardID := strings.TrimSpace(input.CardID)
	slot := normalizeShareCardSlot(input.Slot)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if !isValidShareCardSlot(slot) {
		return nil, ErrShareInvalidCardSlot
	}
	if strings.TrimSpace(input.FileName) == "" || input.FileReader == nil {
		return nil, ErrShareFileRequired
	}

	mimeType := detectUploadMimeType(input.FileName, input.MimeType)

	storedAsset, err := s.storeCardAssetMedia(
		ctx,
		ownerID,
		cardID,
		slot,
		input.FileName,
		input.MimeType,
		input.FileReader,
		input.MaxFileSize,
	)
	if err != nil {
		return nil, err
	}

	var oldStoredFileName string
	var oldStorageBackend string
	var oldStorageNamespaceID *string
	var oldStorageObjectKey string
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		var asset model.SharePlatformCardAsset
		if err := tx.First(&asset, "card_id = ? AND slot = ?", card.ID, slot).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				asset = model.SharePlatformCardAsset{
					CardID:             card.ID,
					Slot:               slot,
					StorageBackend:     storedAsset.StorageBackend,
					StorageNamespaceID: storedAsset.StorageNamespaceID,
					StorageObjectKey:   storedAsset.StorageObjectKey,
					StorageVersionID:   storedAsset.StorageVersionID,
					StoredFileName:     storedAsset.StoredFileName,
					OriginalFileName:   filepath.Base(input.FileName),
					MimeType:           mimeType,
					Size:               storedAsset.Size,
					SortOrder:          shareCardSlotSortOrder(slot),
				}
				if err := tx.Create(&asset).Error; err != nil {
					return err
				}
				card.UpdatedAt = time.Now().UTC()
				return tx.Model(&model.SharePlatformCard{}).
					Where("id = ?", card.ID).
					Updates(map[string]any{
						"updated_at":                card.UpdatedAt,
						"review_status":             card.ReviewStatus,
						"submitted_at":              card.SubmittedAt,
						"reviewed_at":               card.ReviewedAt,
						"review_reason":             card.ReviewReason,
						"reviewer_external_user_id": card.ReviewerExternalUserID,
					}).Error
			}
			return err
		}

		oldStoredFileName = strings.TrimSpace(asset.StoredFileName)
		oldStorageBackend = strings.TrimSpace(asset.StorageBackend)
		oldStorageNamespaceID = asset.StorageNamespaceID
		oldStorageObjectKey = strings.TrimSpace(asset.StorageObjectKey)
		asset.StorageBackend = storedAsset.StorageBackend
		asset.StorageNamespaceID = storedAsset.StorageNamespaceID
		asset.StorageObjectKey = storedAsset.StorageObjectKey
		asset.StorageVersionID = storedAsset.StorageVersionID
		asset.StoredFileName = storedAsset.StoredFileName
		asset.OriginalFileName = filepath.Base(input.FileName)
		asset.MimeType = mimeType
		asset.Size = storedAsset.Size
		asset.SortOrder = shareCardSlotSortOrder(slot)
		asset.UpdatedAt = time.Now().UTC()
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		_ = s.deleteCardStoredMedia(ctx, ownerID, storedAsset.StorageBackend, storedAsset.StorageNamespaceID, storedAsset.StorageObjectKey, storedAsset.StoredFileName)
		return nil, err
	}
	if hasShareStoredMedia(oldStorageBackend, oldStorageNamespaceID, oldStorageObjectKey, oldStoredFileName) &&
		(oldStoredFileName != storedAsset.StoredFileName || oldStorageObjectKey != storedAsset.StorageObjectKey) {
		_ = s.deleteCardStoredMedia(ctx, ownerID, oldStorageBackend, oldStorageNamespaceID, oldStorageObjectKey, oldStoredFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) ReplaceCardCoverByOwner(
	ctx context.Context,
	ownerID,
	cardID,
	fileName,
	mimeType string,
	fileReader io.Reader,
	maxFileSize int64,
) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	fileName = strings.TrimSpace(fileName)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if fileName == "" || fileReader == nil {
		return nil, ErrShareFileRequired
	}

	normalizedMimeType := detectUploadMimeType(fileName, mimeType)
	if !strings.HasPrefix(strings.ToLower(normalizedMimeType), "image/") {
		return nil, ErrShareInvalidImageData
	}

	storedCover, err := s.storeCardCoverMedia(
		ctx,
		ownerID,
		cardID,
		fileName,
		mimeType,
		fileReader,
		maxFileSize,
	)
	if err != nil {
		return nil, err
	}

	oldStoredFileName := ""
	oldStorageBackend := ""
	var oldStorageNamespaceID *string
	oldStorageObjectKey := ""
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		oldStoredFileName = strings.TrimSpace(card.StoredFileName)
		oldStorageBackend = strings.TrimSpace(card.StorageBackend)
		oldStorageNamespaceID = card.StorageNamespaceID
		oldStorageObjectKey = strings.TrimSpace(card.StorageObjectKey)
		card.StorageBackend = storedCover.StorageBackend
		card.StorageNamespaceID = storedCover.StorageNamespaceID
		card.StorageObjectKey = storedCover.StorageObjectKey
		card.StorageVersionID = storedCover.StorageVersionID
		card.StoredFileName = storedCover.StoredFileName
		card.OriginalFileName = filepath.Base(fileName)
		card.MimeType = normalizedMimeType
		card.Size = storedCover.Size
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"storage_backend":           card.StorageBackend,
				"storage_namespace_id":      card.StorageNamespaceID,
				"storage_object_key":        card.StorageObjectKey,
				"storage_version_id":        card.StorageVersionID,
				"stored_file_name":          card.StoredFileName,
				"original_file_name":        card.OriginalFileName,
				"mime_type":                 card.MimeType,
				"size":                      card.Size,
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		_ = s.deleteCardStoredMedia(ctx, ownerID, storedCover.StorageBackend, storedCover.StorageNamespaceID, storedCover.StorageObjectKey, storedCover.StoredFileName)
		return nil, err
	}

	if hasShareStoredMedia(oldStorageBackend, oldStorageNamespaceID, oldStorageObjectKey, oldStoredFileName) &&
		(oldStoredFileName != storedCover.StoredFileName || oldStorageObjectKey != storedCover.StorageObjectKey) {
		_ = s.deleteCardStoredMedia(ctx, ownerID, oldStorageBackend, oldStorageNamespaceID, oldStorageObjectKey, oldStoredFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) DeleteCardCoverByOwner(ctx context.Context, ownerID, cardID string) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}

	storedFileName := ""
	storageBackend := ""
	var storageNamespaceID *string
	storageObjectKey := ""
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		storedFileName = strings.TrimSpace(card.StoredFileName)
		storageBackend = strings.TrimSpace(card.StorageBackend)
		storageNamespaceID = card.StorageNamespaceID
		storageObjectKey = strings.TrimSpace(card.StorageObjectKey)
		card.StorageBackend = model.ShareMediaStorageModeLocal
		card.StorageNamespaceID = nil
		card.StorageObjectKey = ""
		card.StorageVersionID = ""
		card.StoredFileName = ""
		card.OriginalFileName = ""
		card.MimeType = ""
		card.Size = 0
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"storage_backend":           card.StorageBackend,
				"storage_namespace_id":      card.StorageNamespaceID,
				"storage_object_key":        card.StorageObjectKey,
				"storage_version_id":        card.StorageVersionID,
				"stored_file_name":          card.StoredFileName,
				"original_file_name":        card.OriginalFileName,
				"mime_type":                 card.MimeType,
				"size":                      card.Size,
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		return nil, err
	}

	if hasShareStoredMedia(storageBackend, storageNamespaceID, storageObjectKey, storedFileName) {
		_ = s.deleteCardStoredMedia(ctx, ownerID, storageBackend, storageNamespaceID, storageObjectKey, storedFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) DeleteCardAssetByOwner(ctx context.Context, ownerID, cardID, slot string) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	slot = normalizeShareCardSlot(slot)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if !isValidShareCardSlot(slot) {
		return nil, ErrShareInvalidCardSlot
	}

	storedFileName := ""
	storageBackend := ""
	var storageNamespaceID *string
	storageObjectKey := ""
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		var asset model.SharePlatformCardAsset
		if err := tx.First(&asset, "card_id = ? AND slot = ?", card.ID, slot).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		storedFileName = strings.TrimSpace(asset.StoredFileName)
		storageBackend = strings.TrimSpace(asset.StorageBackend)
		storageNamespaceID = asset.StorageNamespaceID
		storageObjectKey = strings.TrimSpace(asset.StorageObjectKey)

		var count int64
		if err := tx.Model(&model.SharePlatformCardAsset{}).Where("card_id = ?", card.ID).Count(&count).Error; err != nil {
			return err
		}
		if count <= 1 {
			return ErrShareCardAssetRequired
		}

		if err := tx.Delete(&asset).Error; err != nil {
			return err
		}
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		return nil, err
	}
	if hasShareStoredMedia(storageBackend, storageNamespaceID, storageObjectKey, storedFileName) {
		_ = s.deleteCardStoredMedia(ctx, ownerID, storageBackend, storageNamespaceID, storageObjectKey, storedFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) DeleteCardByOwner(ctx context.Context, ownerID, cardID string) error {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)

	var creatorID string
	type mediaRef struct {
		backend     string
		namespaceID *string
		objectKey   string
		storedName  string
	}
	storedMedia := make([]mediaRef, 0, 8)
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}

		creatorID = card.CreatorExternalUserID
		var assets []model.SharePlatformCardAsset
		if err := tx.Where("card_id = ?", card.ID).Order("sort_order ASC, created_at ASC").Find(&assets).Error; err != nil {
			return err
		}
		for _, asset := range assets {
			if hasShareStoredMedia(asset.StorageBackend, asset.StorageNamespaceID, asset.StorageObjectKey, asset.StoredFileName) {
				storedMedia = append(storedMedia, mediaRef{
					backend:     strings.TrimSpace(asset.StorageBackend),
					namespaceID: asset.StorageNamespaceID,
					objectKey:   strings.TrimSpace(asset.StorageObjectKey),
					storedName:  strings.TrimSpace(asset.StoredFileName),
				})
			}
		}
		if hasShareStoredMedia(card.StorageBackend, card.StorageNamespaceID, card.StorageObjectKey, card.StoredFileName) {
			storedMedia = append(storedMedia, mediaRef{
				backend:     strings.TrimSpace(card.StorageBackend),
				namespaceID: card.StorageNamespaceID,
				objectKey:   strings.TrimSpace(card.StorageObjectKey),
				storedName:  strings.TrimSpace(card.StoredFileName),
			})
		}
		if err := tx.Where("card_id = ?", card.ID).Delete(&model.SharePlatformDownloadLog{}).Error; err != nil {
			return err
		}
		if err := tx.Where("card_id = ?", card.ID).Delete(&model.SharePlatformCardAsset{}).Error; err != nil {
			return err
		}
		return tx.Delete(&card).Error
	})
	if err != nil {
		return err
	}

	for _, item := range storedMedia {
		if removeErr := s.deleteCardStoredMedia(ctx, creatorID, item.backend, item.namespaceID, item.objectKey, item.storedName); removeErr != nil {
			s.logger.Warn(
				"share remove stored file failed",
				zap.Error(removeErr),
				zap.String("card_id", cardID),
				zap.String("stored_file_name", item.storedName),
			)
		}
	}
	return nil
}
