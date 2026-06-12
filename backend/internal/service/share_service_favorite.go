package service

import (
	"context"
	"errors"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

func (s *ShareService) FavoriteCard(ctx context.Context, userID, cardID string) error {
	userID = strings.TrimSpace(userID)
	cardID = strings.TrimSpace(cardID)
	if userID == "" || cardID == "" {
		return ErrShareUserNotFound
	}

	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", cardID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareCardNotFound
		}
		return err
	}

	if card.Visibility != model.SharePlatformCardVisibilityPublic ||
		card.Status != model.SharePlatformCardStatusPublished ||
		card.ReviewStatus != model.SharePlatformCardReviewStatusApproved {
		return ErrShareCardForbidden
	}

	exists, err := s.IsFavorited(ctx, userID, cardID)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	favorite := model.SharePlatformCardFavorite{
		ExternalUserID: userID,
		CardID:         cardID,
	}
	return s.db.WithContext(ctx).Create(&favorite).Error
}

func (s *ShareService) UnfavoriteCard(ctx context.Context, userID, cardID string) error {
	userID = strings.TrimSpace(userID)
	cardID = strings.TrimSpace(cardID)
	if userID == "" || cardID == "" {
		return ErrShareUserNotFound
	}

	result := s.db.WithContext(ctx).
		Where("external_user_id = ? AND card_id = ?", userID, cardID).
		Delete(&model.SharePlatformCardFavorite{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrShareFavoriteNotFound
	}
	return nil
}

func (s *ShareService) IsFavorited(ctx context.Context, userID, cardID string) (bool, error) {
	userID = strings.TrimSpace(userID)
	cardID = strings.TrimSpace(cardID)
	if userID == "" || cardID == "" {
		return false, nil
	}

	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCardFavorite{}).
		Where("external_user_id = ? AND card_id = ?", userID, cardID).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *ShareService) CountFavorites(ctx context.Context, cardIDs []string) (map[string]int64, error) {
	result := make(map[string]int64, len(cardIDs))
	if len(cardIDs) == 0 {
		return result, nil
	}

	rows := make([]struct {
		CardID string
		Count  int64
	}, 0, len(cardIDs))
	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCardFavorite{}).
		Select("card_id, COUNT(*) as count").
		Where("card_id IN ?", cardIDs).
		Group("card_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		result[row.CardID] = row.Count
	}
	return result, nil
}

func (s *ShareService) BatchIsFavorited(ctx context.Context, userID string, cardIDs []string) (map[string]bool, error) {
	result := make(map[string]bool, len(cardIDs))
	if userID == "" || len(cardIDs) == 0 {
		return result, nil
	}

	rows := make([]struct {
		CardID string
	}, 0, len(cardIDs))
	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCardFavorite{}).
		Select("card_id").
		Where("external_user_id = ? AND card_id IN ?", userID, cardIDs).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		result[row.CardID] = true
	}
	return result, nil
}

func (s *ShareService) ListFavoritedCards(ctx context.Context, userID string, page, size int) ([]ShareDiscoverCardItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	userID = strings.TrimSpace(userID)
	if userID == "" {
		return []ShareDiscoverCardItem{}, 0, ErrShareUserNotFound
	}

	var total int64
	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCardFavorite{}).
		Where("external_user_id = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []ShareDiscoverCardItem{}, 0, nil
	}

	offset := (page - 1) * size
	var favorites []model.SharePlatformCardFavorite
	if err := s.db.WithContext(ctx).
		Where("external_user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&favorites).Error; err != nil {
		return nil, 0, err
	}

	cardIDs := make([]string, 0, len(favorites))
	for _, favorite := range favorites {
		cardIDs = append(cardIDs, favorite.CardID)
	}

	cards := make([]model.SharePlatformCard, 0, len(cardIDs))
	if err := s.db.WithContext(ctx).
		Where("id IN ?", cardIDs).
		Find(&cards).Error; err != nil {
		return nil, 0, err
	}

	cardOrder := make(map[string]int, len(cardIDs))
	for index, id := range cardIDs {
		cardOrder[id] = index
	}
	orderedCards := make([]model.SharePlatformCard, 0, len(cards))
	for _, favorite := range favorites {
		for _, card := range cards {
			if card.ID == favorite.CardID {
				orderedCards = append(orderedCards, card)
				break
			}
		}
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverCards(ctx, orderedCards, assetsByCardID, userID)
	if err != nil {
		return nil, 0, err
	}

	for index := range items {
		items[index].IsFavorited = true
	}

	return items, total, nil
}
