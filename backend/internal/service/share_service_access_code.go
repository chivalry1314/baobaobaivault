package service

import (
	"context"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"time"
)

func (s *ShareService) GetCardAccessCodeByOwner(ctx context.Context, ownerID, cardID string) (*ShareCardAccessCodeConfig, error) {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return nil, err
	}

	config := buildShareCardAccessCodeConfig(card)
	return &config, nil
}

func (s *ShareService) UpdateCardAccessCodeByOwner(ctx context.Context, input ShareUpdateCardAccessCodeInput) (*ShareCardAccessCodeConfig, error) {
	card, err := s.getCardByOwner(ctx, input.OwnerID, input.CardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, input.OwnerID); err != nil {
		return nil, err
	}
	if card.ReviewStatus != model.SharePlatformCardReviewStatusApproved {
		return nil, ErrShareCardForbidden
	}

	normalizedCode := normalizeShareAccessCode(input.Code)
	if !isValidShareAccessCode(normalizedCode) {
		return nil, ErrShareInvalidAccessCode
	}
	if !isValidShareAccessExpireDays(input.ExpireDays) {
		return nil, ErrShareInvalidAccessRules
	}

	usageLimit := input.UsageLimit
	if input.Unlimited {
		usageLimit = 0
	}
	if usageLimit < 0 || usageLimit > 100000 {
		return nil, ErrShareInvalidAccessRules
	}
	if !input.Unlimited && usageLimit == 0 {
		return nil, ErrShareInvalidAccessRules
	}

	expiresAt := computeShareAccessCodeExpiry(input.ExpireDays)

	card.AccessCode = normalizedCode
	card.AccessCodeExpiresAt = expiresAt
	card.AccessCodeUsageLimit = usageLimit
	card.AccessCodeUsageCount = 0
	card.UpdatedAt = time.Now().UTC()

	if err := s.db.WithContext(ctx).Save(card).Error; err != nil {
		return nil, err
	}

	config := buildShareCardAccessCodeConfig(card)
	return &config, nil
}

func (s *ShareService) DeleteCardAccessCodeByOwner(ctx context.Context, ownerID, cardID string) error {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return err
	}

	card.AccessCode = ""
	card.AccessCodeExpiresAt = nil
	card.AccessCodeUsageLimit = 0
	card.AccessCodeUsageCount = 0
	card.UpdatedAt = time.Now().UTC()

	return s.db.WithContext(ctx).Save(card).Error
}
