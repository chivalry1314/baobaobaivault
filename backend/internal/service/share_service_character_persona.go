package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/cache"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

const (
	shareCharacterPersonaProtocol     = "baobaobaiphone.character-persona-package.v1"
	shareCharacterPersonaMaxReadBytes = 2 * 1024 * 1024
)

type ShareCharacterPersonaView struct {
	Protocol     string   `json:"protocol"`
	Format       string   `json:"format"`
	Supported    bool     `json:"supported"`
	Name         string   `json:"name"`
	Author       string   `json:"author"`
	Version      string   `json:"version"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
	ContactCount int      `json:"contactCount"`
	FileName     string   `json:"fileName"`
	MimeType     string   `json:"mimeType"`
	Size         int64    `json:"size"`
}

type ShareDiscoverCharacterPersonaItem struct {
	Card             ShareCardView             `json:"card"`
	Creator          SharePublicUser           `json:"creator"`
	Stats            ShareCardStats            `json:"stats"`
	Asset            ShareCardAssetView        `json:"asset"`
	CharacterPersona ShareCharacterPersonaView `json:"characterPersona"`
	AccessCodeStatus ShareCardAccessStatus     `json:"accessCodeStatus"`
}

type shareCharacterPersonaPackageDescriptor struct {
	Version  int                            `json:"version"`
	Contacts []shareCharacterPersonaContact `json:"contacts"`
	Name     string                         `json:"name"`
	Author   string                         `json:"author"`
	Tags     []string                       `json:"tags"`
}

type shareCharacterPersonaContact struct {
	Name           string `json:"name"`
	Role           string `json:"role"`
	Phone          string `json:"phone"`
	WechatRelation string `json:"wechatRelation"`
	Avatar         string `json:"avatar"`
	Description    string `json:"description"`
	Greeting       string `json:"greeting"`
	Personality    string `json:"personality"`
	Background     string `json:"background"`
	Note           string `json:"note"`
}

func (s *ShareService) ListDiscoverCharacterPersonas(ctx context.Context, page, size int) ([]ShareDiscoverCharacterPersonaItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	cacheKey := cache.Key("discover", "character_personas", fmt.Sprintf("%d", page), fmt.Sprintf("%d", size))
	var cached struct {
		Items []ShareDiscoverCharacterPersonaItem `json:"items"`
		Total int64                               `json:"total"`
	}
	if s.cache.Get(ctx, cacheKey, &cached) {
		return cached.Items, cached.Total, nil
	}

	baseQuery := func() *gorm.DB {
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", "character_persona").
			Where("share_platform_cards.visibility = ? AND share_platform_cards.status = ? AND share_platform_cards.review_status = ?",
				model.SharePlatformCardVisibilityPublic,
				model.SharePlatformCardStatusPublished,
				model.SharePlatformCardReviewStatusApproved,
			)
	}

	var total int64
	if err := baseQuery().
		Distinct("share_platform_cards.id").
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		_ = s.cache.Set(ctx, cacheKey, struct {
			Items []ShareDiscoverCharacterPersonaItem `json:"items"`
			Total int64                               `json:"total"`
		}{Items: []ShareDiscoverCharacterPersonaItem{}, Total: 0}, 60*time.Second)
		return []ShareDiscoverCharacterPersonaItem{}, 0, nil
	}

	offset := (page - 1) * size
	cards := make([]model.SharePlatformCard, 0, size)
	if err := baseQuery().
		Select("share_platform_cards.*").
		Distinct().
		Order("share_platform_cards.updated_at DESC").
		Offset(offset).
		Limit(size).
		Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	if len(cards) == 0 {
		_ = s.cache.Set(ctx, cacheKey, struct {
			Items []ShareDiscoverCharacterPersonaItem `json:"items"`
			Total int64                               `json:"total"`
		}{Items: []ShareDiscoverCharacterPersonaItem{}, Total: total}, 60*time.Second)
		return []ShareDiscoverCharacterPersonaItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverCharacterPersonas(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	_ = s.cache.Set(ctx, cacheKey, struct {
		Items []ShareDiscoverCharacterPersonaItem `json:"items"`
		Total int64                               `json:"total"`
	}{Items: items, Total: total}, 60*time.Second)
	return items, total, nil
}

func (s *ShareService) mapDiscoverCharacterPersonas(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverCharacterPersonaItem, error) {
	if len(cards) == 0 {
		return []ShareDiscoverCharacterPersonaItem{}, nil
	}

	creatorIDs := make([]string, 0, len(cards))
	creatorSet := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		if _, exists := creatorSet[card.CreatorExternalUserID]; exists {
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

	favoriteCounts, err := s.CountFavorites(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, err
	}
	statsByCard, _ := aggregateStatsFromCards(cards, favoriteCounts)

	items := make([]ShareDiscoverCharacterPersonaItem, 0, len(cards))
	for _, card := range cards {
		assets := assetsByCardID[card.ID]
		personaAsset := findShareCardAssetBySlot(assets, "character_persona")
		if personaAsset == nil {
			continue
		}

		creatorView := SharePublicUser{
			ID:       card.CreatorExternalUserID,
			Username: "creator",
			Nickname: "Creator",
			Avatar:   "",
		}
		if creator, exists := creatorMap[card.CreatorExternalUserID]; exists {
			creatorView = toSharePublicUser(&creator)
		}

		persona, err := s.buildCharacterPersonaView(ctx, &card, personaAsset)
		if err != nil {
			return nil, err
		}

		items = append(items, ShareDiscoverCharacterPersonaItem{
			Card:             toShareCardView(&card, assets),
			Creator:          creatorView,
			Stats:            statsByCard[card.ID],
			Asset:            buildShareCardAssetView(card.ID, *personaAsset),
			CharacterPersona: persona,
			AccessCodeStatus: deriveShareCardAccessStatus(&card, false),
		})
	}

	return items, nil
}

func (s *ShareService) buildCharacterPersonaView(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (ShareCharacterPersonaView, error) {
	view := ShareCharacterPersonaView{
		Protocol:     shareCharacterPersonaProtocol,
		Format:       detectShareCharacterPersonaFormat(asset.OriginalFileName, asset.MimeType),
		Supported:    false,
		Name:         strings.TrimSpace(card.Title),
		Author:       "",
		Version:      "",
		Description:  strings.TrimSpace(card.Description),
		Tags:         decodeShareCardTags(card.TagsText),
		ContactCount: 0,
		FileName:     strings.TrimSpace(asset.OriginalFileName),
		MimeType:     strings.TrimSpace(asset.MimeType),
		Size:         asset.Size,
	}

	if card == nil || asset == nil {
		return view, nil
	}

	if asset.Size <= 0 || asset.Size > shareCharacterPersonaMaxReadBytes {
		return view, nil
	}

	reader, _, err := s.OpenCardFile(ctx, card, asset)
	if err != nil {
		return view, nil
	}
	defer reader.Close()

	limited := io.LimitReader(reader, shareCharacterPersonaMaxReadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil || len(data) == 0 || len(data) > shareCharacterPersonaMaxReadBytes {
		return view, nil
	}

	descriptor, err := inspectShareCharacterPersonaPackage(data)
	if err != nil {
		return view, nil
	}

	return mergeShareCharacterPersonaDescriptor(view, descriptor), nil
}

func detectShareCharacterPersonaFormat(fileName, mimeType string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	if ext == ".json" {
		return "json"
	}
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	if mimeType == "application/json" || mimeType == "text/json" {
		return "json"
	}
	return "unknown"
}

func inspectShareCharacterPersonaPackage(data []byte) (shareCharacterPersonaPackageDescriptor, error) {
	var descriptor shareCharacterPersonaPackageDescriptor
	if err := json.Unmarshal(data, &descriptor); err != nil {
		return shareCharacterPersonaPackageDescriptor{}, ErrShareInvalidCharacterPersonaPackage
	}
	if len(descriptor.Contacts) == 0 {
		return shareCharacterPersonaPackageDescriptor{}, ErrShareInvalidCharacterPersonaPackage
	}
	return descriptor, nil
}

func mergeShareCharacterPersonaDescriptor(view ShareCharacterPersonaView, descriptor shareCharacterPersonaPackageDescriptor) ShareCharacterPersonaView {
	view.Supported = true
	if name := strings.TrimSpace(descriptor.Name); name != "" {
		view.Name = name
	}
	if author := strings.TrimSpace(descriptor.Author); author != "" {
		view.Author = author
	}
	if version := strings.TrimSpace(fmt.Sprintf("%d", descriptor.Version)); version != "" && version != "0" {
		view.Version = version
	}
	if len(descriptor.Tags) > 0 {
		view.Tags = normalizeShareCharacterPersonaTags(descriptor.Tags)
	}
	if len(view.Tags) == 0 {
		view.Tags = []string{"character_persona"}
	}
	view.ContactCount = len(descriptor.Contacts)
	return view
}

func normalizeShareCharacterPersonaTags(tags []string) []string {
	if len(tags) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, raw := range tags {
		tag := strings.TrimSpace(raw)
		if tag == "" {
			continue
		}
		if _, exists := seen[tag]; exists {
			continue
		}
		seen[tag] = struct{}{}
		result = append(result, tag)
	}
	return result
}

func validateAndCloneShareCharacterPersonaReader(fileName string, reader io.Reader) (io.Reader, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}

	data, err := io.ReadAll(io.LimitReader(reader, shareCharacterPersonaMaxReadBytes+1))
	if err != nil {
		return nil, ErrShareInvalidCharacterPersonaPackage
	}
	if len(data) == 0 {
		return nil, ErrShareFileRequired
	}
	if len(data) > shareCharacterPersonaMaxReadBytes {
		return nil, ErrShareCharacterPersonaPackageTooLarge
	}
	if _, err := inspectShareCharacterPersonaPackage(data); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (s *ShareService) loadCardCharacterPersonaView(ctx context.Context, card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) (*ShareCharacterPersonaView, error) {
	asset := findShareCardAssetBySlot(assets, "character_persona")
	if asset == nil {
		return nil, nil
	}

	view, err := s.buildCharacterPersonaView(ctx, card, asset)
	if err != nil {
		return nil, err
	}
	return &view, nil
}
