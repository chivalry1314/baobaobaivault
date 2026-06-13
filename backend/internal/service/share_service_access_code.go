package service

import (
	"context"
	"strings"

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
	nextAccessMode := normalizeShareCardAccessMode(input.AccessMode)
	if !isValidShareCardAccessMode(input.AccessMode) {
		return nil, ErrShareInvalidAccessMode
	}
	if strings.TrimSpace(input.Visibility) != "" && !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}
	if strings.TrimSpace(input.Status) != "" && !isValidShareStatus(input.Status) {
		return nil, ErrShareInvalidCardStatus
	}

	now := time.Now().UTC()
	card.AccessMode = nextAccessMode
	if strings.TrimSpace(input.Visibility) != "" {
		card.Visibility = normalizeShareVisibility(input.Visibility)
	}
	if strings.TrimSpace(input.Status) != "" {
		card.Status = strings.ToLower(strings.TrimSpace(input.Status))
	}

	if nextAccessMode == model.SharePlatformCardAccessModeFree {
		card.AccessCode = ""
		card.AccessCodeExpiresAt = nil
		card.AccessCodeUsageLimit = 0
		card.AccessCodeUsageCount = 0
		card.UpdatedAt = now
		if err := s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"access_mode":              card.AccessMode,
				"visibility":               card.Visibility,
				"status":                   card.Status,
				"access_code":              card.AccessCode,
				"access_code_expires_at":   card.AccessCodeExpiresAt,
				"access_code_usage_limit":  card.AccessCodeUsageLimit,
				"access_code_usage_count":  card.AccessCodeUsageCount,
				"updated_at":               card.UpdatedAt,
			}).Error; err != nil {
			return nil, err
		}
		config := buildShareCardAccessCodeConfig(card)
		s.invalidateDiscoverCache(ctx)
		return &config, nil
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

	card.AccessCode = normalizedCode
	card.AccessCodeExpiresAt = computeShareAccessCodeExpiry(input.ExpireDays)
	card.AccessCodeUsageLimit = usageLimit
	card.AccessCodeUsageCount = 0
	card.UpdatedAt = now

	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCard{}).
		Where("id = ?", card.ID).
		Updates(map[string]any{
			"access_mode":              card.AccessMode,
			"visibility":               card.Visibility,
			"status":                   card.Status,
			"access_code":              card.AccessCode,
			"access_code_expires_at":   card.AccessCodeExpiresAt,
			"access_code_usage_limit":  card.AccessCodeUsageLimit,
			"access_code_usage_count":  card.AccessCodeUsageCount,
			"updated_at":               card.UpdatedAt,
		}).Error; err != nil {
		return nil, err
	}

	config := buildShareCardAccessCodeConfig(card)
	s.invalidateDiscoverCache(ctx)
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

	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformCard{}).
		Where("id = ?", card.ID).
		Updates(map[string]any{
			"access_code":             card.AccessCode,
			"access_code_expires_at":  card.AccessCodeExpiresAt,
			"access_code_usage_limit": card.AccessCodeUsageLimit,
			"access_code_usage_count": card.AccessCodeUsageCount,
			"updated_at":              card.UpdatedAt,
		}).Error; err != nil {
		return err
	}
	s.invalidateDiscoverCache(ctx)
	return nil
}
