package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/cache"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

var discoverCardSlots = map[string]struct{}{
	"system_theme":      {},
	"wechat_theme":      {},
	"app":               {},
	"character_persona": {},
	"world_book":        {},
	"desktop_component": {},
}

func (s *ShareService) ListDiscoverCards(ctx context.Context, page, size int, viewerUserID, slot string) ([]ShareDiscoverCardItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	slot = strings.TrimSpace(slot)
	if slot != "" {
		if _, ok := discoverCardSlots[slot]; !ok {
			return []ShareDiscoverCardItem{}, 0, nil
		}
	}

	cacheKey := cache.Key("discover", "cards", fmt.Sprintf("%d", page), fmt.Sprintf("%d", size), slot, viewerUserID)
	var cached struct {
		Items []ShareDiscoverCardItem `json:"items"`
		Total int64                   `json:"total"`
	}
	if s.cache.Get(ctx, cacheKey, &cached) {
		return cached.Items, cached.Total, nil
	}

	query := s.db.WithContext(ctx).
		Model(&model.SharePlatformCard{}).
		Where("visibility = ? AND status = ? AND review_status = ?",
			model.SharePlatformCardVisibilityPublic,
			model.SharePlatformCardStatusPublished,
			model.SharePlatformCardReviewStatusApproved,
		)

	if slot != "" {
		query = query.Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", slot)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []ShareDiscoverCardItem{}, 0, nil
	}

	offset := (page - 1) * size
	cards := make([]model.SharePlatformCard, 0, size)
	if err := query.
		Order("updated_at DESC").
		Offset(offset).
		Limit(size).
		Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	if len(cards) == 0 {
		_ = s.cache.Set(ctx, cacheKey, struct {
			Items []ShareDiscoverCardItem `json:"items"`
			Total int64                   `json:"total"`
		}{Items: []ShareDiscoverCardItem{}, Total: total}, 60*time.Second)
		return []ShareDiscoverCardItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverCards(ctx, cards, assetsByCardID, viewerUserID)
	if err != nil {
		return nil, 0, err
	}
	_ = s.cache.Set(ctx, cacheKey, struct {
		Items []ShareDiscoverCardItem `json:"items"`
		Total int64                   `json:"total"`
	}{Items: items, Total: total}, 60*time.Second)
	return items, total, nil
}

func (s *ShareService) ListDashboardByUser(ctx context.Context, userID string) (*ShareDashboard, error) {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	cards := make([]model.SharePlatformCard, 0, 32)
	if err := s.db.WithContext(ctx).
		Where("creator_external_user_id = ?", user.ID).
		Order("updated_at DESC").
		Find(&cards).Error; err != nil {
		return nil, err
	}

	cardIDs := make([]string, 0, len(cards))
	totalPublic := int64(0)
	for _, card := range cards {
		cardIDs = append(cardIDs, card.ID)
		if card.Visibility == model.SharePlatformCardVisibilityPublic &&
			card.Status == model.SharePlatformCardStatusPublished &&
			card.ReviewStatus == model.SharePlatformCardReviewStatusApproved {
			totalPublic++
		}
	}

	favoriteCounts, err := s.CountFavorites(ctx, cardIDs)
	if err != nil {
		return nil, err
	}
	statsByCard, totalDownloads := aggregateStatsFromCards(cards, favoriteCounts)
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareDashboardCard, 0, len(cards))
	for _, card := range cards {
		accessCode := strings.TrimSpace(card.AccessCode)
		items = append(items, ShareDashboardCard{
			Card:          toShareCardView(&card, assetsByCardID[card.ID]),
			Stats:         statsByCard[card.ID],
			HasAccessCode: accessCode != "",
			AccessCode:    accessCode,
		})
	}

	return &ShareDashboard{
		User:  toShareSessionUser(&user),
		Cards: items,
		Stats: ShareDashboardStats{
			TotalCards:     int64(len(cards)),
			TotalPublic:    totalPublic,
			TotalDownloads: totalDownloads,
		},
	}, nil
}

func (s *ShareService) ListAccessCodeDashboardByUser(ctx context.Context, userID string) (*ShareAccessCodeDashboard, error) {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	cards := make([]model.SharePlatformCard, 0, 32)
	if err := s.db.WithContext(ctx).
		Where("creator_external_user_id = ?", user.ID).
		Order("updated_at DESC").
		Find(&cards).Error; err != nil {
		return nil, err
	}

	cardIDs := make([]string, 0, len(cards))
	for _, card := range cards {
		cardIDs = append(cardIDs, card.ID)
	}

	favoriteCounts, err := s.CountFavorites(ctx, cardIDs)
	if err != nil {
		return nil, err
	}
	statsByCard, _ := aggregateStatsFromCards(cards, favoriteCounts)
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareAccessCodeDashboardItem, 0, len(cards))
	availableCards := make([]ShareCardView, 0, len(cards))
	for _, card := range cards {
		cardView := toShareCardView(&card, assetsByCardID[card.ID])
		config := buildShareCardAccessCodeConfig(&card)
		hasAccessCode := strings.TrimSpace(config.Code) != ""
		isPubliclyVisible := card.Visibility == model.SharePlatformCardVisibilityPublic &&
			card.Status == model.SharePlatformCardStatusPublished &&
			card.ReviewStatus == model.SharePlatformCardReviewStatusApproved
		canReuseCurrentAccessCode := hasAccessCode && config.IsActive && isPubliclyVisible

		// Any card without a currently usable public code should be selectable for generating a new code again.
		if !canReuseCurrentAccessCode {
			availableCards = append(availableCards, cardView)
		}

		if !hasAccessCode {
			continue
		}

		items = append(items, ShareAccessCodeDashboardItem{
			Card:              cardView,
			Stats:             statsByCard[card.ID],
			Config:            config,
			IsPubliclyVisible: isPubliclyVisible,
		})
	}

	return &ShareAccessCodeDashboard{
		User:           toShareSessionUser(&user),
		Items:          items,
		AvailableCards: availableCards,
	}, nil
}
