package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

func (s *ShareService) SubmitCardForReview(ctx context.Context, ownerID, cardID string) (*ShareCardView, error) {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	card.Status = model.SharePlatformCardStatusPublished
	card.ReviewStatus = model.SharePlatformCardReviewStatusPending
	card.SubmittedAt = &now
	card.ReviewedAt = nil
	card.ReviewerExternalUserID = nil
	card.ReviewReason = ""
	card.UpdatedAt = now

	if err := s.db.WithContext(ctx).Save(card).Error; err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) ListReviewDashboard(ctx context.Context, operatorID, status string) (*ShareReviewDashboard, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	query := s.db.WithContext(ctx).Model(&model.SharePlatformCard{})
	normalized := normalizeShareReviewStatus(status)
	if normalized != "" {
		if !isValidShareReviewStatus(normalized) {
			return nil, ErrShareInvalidReviewStatus
		}
		query = query.Where("review_status = ?", normalized)
	} else {
		query = query.Where("review_status IN ?", []string{
			model.SharePlatformCardReviewStatusPending,
			model.SharePlatformCardReviewStatusRejected,
		})
	}

	cards := make([]model.SharePlatformCard, 0, 128)
	if err := query.Order("submitted_at DESC NULLS LAST, updated_at DESC").Find(&cards).Error; err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return &ShareReviewDashboard{Items: []ShareReviewDashboardItem{}}, nil
	}

	cardIDs := collectShareCardIDs(cards)
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	creatorIDs := make([]string, 0, len(cards))
	creatorSet := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		if _, ok := creatorSet[card.CreatorExternalUserID]; ok {
			continue
		}
		creatorSet[card.CreatorExternalUserID] = struct{}{}
		creatorIDs = append(creatorIDs, card.CreatorExternalUserID)
	}
	creators := make([]model.ShareExternalUser, 0, len(creatorIDs))
	if err := s.db.WithContext(ctx).Where("id IN ?", creatorIDs).Find(&creators).Error; err != nil {
		return nil, err
	}
	creatorMap := make(map[string]model.ShareExternalUser, len(creators))
	for _, creator := range creators {
		creatorMap[creator.ID] = creator
	}

	items := make([]ShareReviewDashboardItem, 0, len(cards))
	for _, card := range cards {
		creator := creatorMap[card.CreatorExternalUserID]
		items = append(items, ShareReviewDashboardItem{
			Card:        toShareCardView(&card, assetsByCardID[card.ID]),
			Creator:     toSharePublicUser(&creator),
			SubmittedAt: card.SubmittedAt,
		})
	}
	return &ShareReviewDashboard{Items: items}, nil
}

func (s *ShareService) ApproveCard(ctx context.Context, operatorID, cardID string) (*ShareCardView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		now := time.Now().UTC()
		card.Status = model.SharePlatformCardStatusPublished
		card.ReviewStatus = model.SharePlatformCardReviewStatusApproved
		card.ReviewReason = ""
		card.SubmittedAt = &now
		card.ReviewedAt = &now
		op := strings.TrimSpace(operatorID)
		card.ReviewerExternalUserID = &op
		card.UpdatedAt = now
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

func (s *ShareService) RejectCard(ctx context.Context, operatorID, cardID, reason string) (*ShareCardView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrShareReviewReasonRequired
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		now := time.Now().UTC()
		card.Status = model.SharePlatformCardStatusDraft
		card.ReviewStatus = model.SharePlatformCardReviewStatusRejected
		card.ReviewReason = reason
		card.ReviewedAt = &now
		op := strings.TrimSpace(operatorID)
		card.ReviewerExternalUserID = &op
		card.UpdatedAt = now
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
