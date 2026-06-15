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

func (s *ShareService) GetCardDetail(ctx context.Context, cardID, viewerUserID string) (*ShareCardDetail, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canEdit := viewerUserID != "" && viewerUserID == card.CreatorExternalUserID
	canView := canEdit || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canView = true
	}
	if !canView {
		return nil, ErrShareCardForbidden
	}
	accessCodeStatus := deriveShareCardAccessStatus(&card, canEdit || isManager)
	canDownload := canEdit || isManager || accessCodeStatus == ShareCardAccessStatusNone || accessCodeStatus == ShareCardAccessStatusRequired

	assets, err := s.listCardAssetsByCardID(ctx, card.ID)
	if err != nil {
		return nil, err
	}
	assetsView := buildShareCardAssetViews(card.ID, assets)

	assetBySlot := make(map[string]*model.SharePlatformCardAsset, len(assets))
	for i := range assets {
		assetBySlot[assets[i].Slot] = &assets[i]
	}

	var systemTheme *ShareSystemThemeView
	var wechatTheme *ShareWechatThemeView
	var desktopComponent *ShareDesktopComponentView
	var worldBook *ShareWorldBookView
	var characterPersona *ShareCharacterPersonaView

	for _, slot := range s.slotRegistry.Slots() {
		handler, ok := s.slotRegistry.Get(slot)
		if !ok || !handler.Enabled() || !s.IsCategoryEnabled(slot) {
			continue
		}
		asset := assetBySlot[slot]
		if asset == nil {
			continue
		}
		view, err := handler.BuildView(ctx, s, &card, asset)
		if err != nil {
			return nil, err
		}
		switch v := view.(type) {
		case ShareSystemThemeView:
			systemTheme = &v
		case *ShareSystemThemeView:
			systemTheme = v
		case ShareWechatThemeView:
			wechatTheme = &v
		case *ShareWechatThemeView:
			wechatTheme = v
		case ShareDesktopComponentView:
			desktopComponent = &v
		case *ShareDesktopComponentView:
			desktopComponent = v
		case ShareWorldBookView:
			worldBook = &v
		case *ShareWorldBookView:
			worldBook = v
		case ShareCharacterPersonaView:
			characterPersona = &v
		case *ShareCharacterPersonaView:
			characterPersona = v
		}
	}

	var creator model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&creator, "id = ?", card.CreatorExternalUserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	favoriteCount, err := s.CountFavorites(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	isFavorited, err := s.IsFavorited(ctx, viewerUserID, card.ID)
	if err != nil {
		return nil, err
	}
	statsByCard, _ := aggregateStatsFromCards([]model.SharePlatformCard{card}, favoriteCount)

	return &ShareCardDetail{
		Card:             toShareCardView(&card, assets),
		Creator:          toSharePublicUser(&creator),
		Stats:            statsByCard[card.ID],
		Assets:           assetsView,
		SystemTheme:      systemTheme,
		WechatTheme:      wechatTheme,
		DesktopComponent: desktopComponent,
		WorldBook:        worldBook,
		CharacterPersona: characterPersona,
		CanEdit:          canEdit,
		CanDownload:      canDownload,
		AccessCodeStatus: accessCodeStatus,
		IsFavorited:      isFavorited,
	}, nil
}

func (s *ShareService) CanAccessCardFile(ctx context.Context, cardID, viewerUserID string) (*model.SharePlatformCard, *model.SharePlatformCardAsset, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrShareCardNotFound
		}
		return nil, nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canAccess := viewerUserID == card.CreatorExternalUserID || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canAccess = true
	}
	if !canAccess {
		return nil, nil, ErrShareCardForbidden
	}

	asset, err := s.pickPreviewAssetByCardID(ctx, card.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrShareCardNotFound
		}
		return nil, nil, err
	}
	return &card, asset, nil
}

func (s *ShareService) CanAccessCardCover(ctx context.Context, cardID, viewerUserID string) (*model.SharePlatformCard, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canAccess := viewerUserID == card.CreatorExternalUserID || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canAccess = true
	}
	if !canAccess {
		return nil, ErrShareCardForbidden
	}
	if !hasShareStoredMedia(card.StorageBackend, card.StorageNamespaceID, card.StorageObjectKey, card.StoredFileName) {
		return nil, ErrShareCardNotFound
	}
	return &card, nil
}

func (s *ShareService) GetCardAssetForPreview(ctx context.Context, cardID, slot string) (*model.SharePlatformCardAsset, error) {
	return s.getCardAssetBySlot(ctx, cardID, slot)
}

func (s *ShareService) CanDownloadCardAsset(ctx context.Context, cardID, viewerUserID, accessCode, slot string) (*model.SharePlatformCard, *model.SharePlatformCardAsset, bool, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, ErrShareCardNotFound
		}
		return nil, nil, false, err
	}

	asset, err := s.getCardAssetBySlot(ctx, card.ID, slot)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, ErrShareCardNotFound
		}
		return nil, nil, false, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	if viewerUserID != "" && viewerUserID == card.CreatorExternalUserID {
		return &card, asset, false, nil
	}
	if isManager {
		return &card, asset, false, nil
	}
	if card.Visibility != model.SharePlatformCardVisibilityPublic ||
		card.Status != model.SharePlatformCardStatusPublished ||
		card.ReviewStatus != model.SharePlatformCardReviewStatusApproved {
		return nil, nil, false, ErrShareCardForbidden
	}
	if normalizeShareCardAccessMode(card.AccessMode) == model.SharePlatformCardAccessModeFree {
		return &card, asset, false, nil
	}

	switch deriveShareCardAccessStatus(&card, false) {
	case ShareCardAccessStatusNone:
		return &card, asset, false, nil
	case ShareCardAccessStatusExpired:
		return nil, nil, false, ErrShareAccessCodeExpired
	case ShareCardAccessStatusExhausted:
		return nil, nil, false, ErrShareAccessCodeExhausted
	case ShareCardAccessStatusRequired:
		normalizedCode := normalizeShareAccessCode(accessCode)
		if normalizedCode == "" {
			return nil, nil, false, ErrShareAccessCodeRequired
		}
		if normalizedCode != strings.TrimSpace(card.AccessCode) {
			return nil, nil, false, ErrShareInvalidAccessCode
		}
		return &card, asset, true, nil
	default:
		return nil, nil, false, ErrShareCardForbidden
	}
}

func (s *ShareService) RecordDownload(ctx context.Context, cardID string, downloaderUserID *string, source string, consumeAccessCode bool) error {
	entry := model.SharePlatformDownloadLog{
		CardID:                   strings.TrimSpace(cardID),
		DownloaderExternalUserID: normalizeOptionalID(downloaderUserID),
		Source:                   strings.TrimSpace(source),
		DownloadedAt:             time.Now().UTC(),
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if consumeAccessCode {
			result := tx.Model(&model.SharePlatformCard{}).
				Where("id = ?", strings.TrimSpace(cardID)).
				Where("access_code_usage_limit <= 0 OR access_code_usage_count < access_code_usage_limit").
				UpdateColumn("access_code_usage_count", gorm.Expr("access_code_usage_count + 1"))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrShareAccessCodeExhausted
			}
		}
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}

		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", entry.CardID).
			Updates(map[string]any{
				"download_count":     gorm.Expr("download_count + 1"),
				"last_downloaded_at": entry.DownloadedAt,
			}).Error
	})
}

func (s *ShareService) OpenCardFile(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (io.ReadCloser, int64, error) {
	stream, err := s.openCardStoredMedia(
		ctx,
		card.CreatorExternalUserID,
		asset.StorageBackend,
		asset.StorageNamespaceID,
		asset.StorageObjectKey,
		asset.StoredFileName,
	)
	if err != nil {
		return nil, 0, err
	}
	return stream.Reader, stream.Size, nil
}

func (s *ShareService) OpenCardCoverFile(ctx context.Context, card *model.SharePlatformCard) (io.ReadCloser, int64, error) {
	stream, err := s.openCardStoredMedia(
		ctx,
		card.CreatorExternalUserID,
		card.StorageBackend,
		card.StorageNamespaceID,
		card.StorageObjectKey,
		card.StoredFileName,
	)
	if err != nil {
		return nil, 0, err
	}
	return stream.Reader, stream.Size, nil
}

func (s *ShareService) OpenProfileAsset(userID, storedFileName string) (*os.File, os.FileInfo, error) {
	path := s.getProfileAssetPath(userID, storedFileName)
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}

	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}

	return file, stat, nil
}
