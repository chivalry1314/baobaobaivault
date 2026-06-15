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
	shareWorldBookProtocol     = "baobaobaiphone.world-book-package.v1"
	shareWorldBookMaxReadBytes = 2 * 1024 * 1024
)

type ShareWorldBookView struct {
	Protocol    string   `json:"protocol"`
	Format      string   `json:"format"`
	Supported   bool     `json:"supported"`
	Name        string   `json:"name"`
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	EntryCount  int      `json:"entryCount"`
	FileName    string   `json:"fileName"`
	MimeType    string   `json:"mimeType"`
	Size        int64    `json:"size"`
}

type ShareDiscoverWorldBookItem struct {
	Card             ShareCardView         `json:"card"`
	Creator          SharePublicUser       `json:"creator"`
	Stats            ShareCardStats        `json:"stats"`
	Asset            ShareCardAssetView    `json:"asset"`
	WorldBook        ShareWorldBookView    `json:"worldBook"`
	AccessCodeStatus ShareCardAccessStatus `json:"accessCodeStatus"`
}

type shareWorldBookPackageDescriptor struct {
	Version   int                   `json:"version"`
	WorldBook []shareWorldBookEntry `json:"worldBook"`
	Name      string                `json:"name"`
	Author    string                `json:"author"`
	Tags      []string              `json:"tags"`
}

type shareWorldBookEntry struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Keywords       []string `json:"keywords"`
	Content        string   `json:"content"`
	TriggerMode    string   `json:"triggerMode"`
	InsertionOrder int      `json:"insertionOrder"`
	Scope          string   `json:"scope"`
}

func (s *ShareService) ListDiscoverWorldBooks(ctx context.Context, page, size int) ([]ShareDiscoverWorldBookItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	cacheKey := cache.Key("discover", "world_books", fmt.Sprintf("%d", page), fmt.Sprintf("%d", size))
	var cached struct {
		Items []ShareDiscoverWorldBookItem `json:"items"`
		Total int64                        `json:"total"`
	}
	if s.cache.Get(ctx, cacheKey, &cached) {
		return cached.Items, cached.Total, nil
	}

	baseQuery := func() *gorm.DB {
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", "world_book").
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
			Items []ShareDiscoverWorldBookItem `json:"items"`
			Total int64                        `json:"total"`
		}{Items: []ShareDiscoverWorldBookItem{}, Total: 0}, 60*time.Second)
		return []ShareDiscoverWorldBookItem{}, 0, nil
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
			Items []ShareDiscoverWorldBookItem `json:"items"`
			Total int64                        `json:"total"`
		}{Items: []ShareDiscoverWorldBookItem{}, Total: total}, 60*time.Second)
		return []ShareDiscoverWorldBookItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverWorldBooks(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	_ = s.cache.Set(ctx, cacheKey, struct {
		Items []ShareDiscoverWorldBookItem `json:"items"`
		Total int64                        `json:"total"`
	}{Items: items, Total: total}, 60*time.Second)
	return items, total, nil
}

func (s *ShareService) mapDiscoverWorldBooks(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverWorldBookItem, error) {
	if len(cards) == 0 {
		return []ShareDiscoverWorldBookItem{}, nil
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
	items := make([]ShareDiscoverWorldBookItem, 0, len(cards))
	for _, card := range cards {
		assets := assetsByCardID[card.ID]
		worldBookAsset := findShareCardAssetBySlot(assets, "world_book")
		if worldBookAsset == nil {
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

		worldBook, err := s.buildWorldBookView(ctx, &card, worldBookAsset)
		if err != nil {
			return nil, err
		}

		items = append(items, ShareDiscoverWorldBookItem{
			Card:             toShareCardView(&card, assets),
			Creator:          creatorView,
			Stats:            statsByCard[card.ID],
			Asset:            buildShareCardAssetView(card.ID, *worldBookAsset),
			WorldBook:        worldBook,
			AccessCodeStatus: deriveShareCardAccessStatus(&card, false),
		})
	}

	return items, nil
}

func (s *ShareService) buildWorldBookView(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (ShareWorldBookView, error) {
	view := ShareWorldBookView{
		Protocol:    shareWorldBookProtocol,
		Format:      detectShareWorldBookFormat(asset.OriginalFileName, asset.MimeType),
		Supported:   false,
		Name:        strings.TrimSpace(card.Title),
		Author:      "",
		Version:     "",
		Description: strings.TrimSpace(card.Description),
		Tags:        decodeShareCardTags(card.TagsText),
		EntryCount:  0,
		FileName:    strings.TrimSpace(asset.OriginalFileName),
		MimeType:    strings.TrimSpace(asset.MimeType),
		Size:        asset.Size,
	}

	if card == nil || asset == nil {
		return view, nil
	}

	if asset.Size <= 0 || asset.Size > shareWorldBookMaxReadBytes {
		return view, nil
	}

	reader, _, err := s.OpenCardFile(ctx, card, asset)
	if err != nil {
		return view, nil
	}
	defer reader.Close()

	limited := io.LimitReader(reader, shareWorldBookMaxReadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil || len(data) == 0 || len(data) > shareWorldBookMaxReadBytes {
		return view, nil
	}

	descriptor, err := inspectShareWorldBookPackage(data)
	if err != nil {
		return view, nil
	}

	return mergeShareWorldBookDescriptor(view, descriptor), nil
}

func detectShareWorldBookFormat(fileName, mimeType string) string {
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

func inspectShareWorldBookPackage(data []byte) (shareWorldBookPackageDescriptor, error) {
	var descriptor shareWorldBookPackageDescriptor
	if err := json.Unmarshal(data, &descriptor); err != nil {
		return shareWorldBookPackageDescriptor{}, ErrShareInvalidWorldBookPackage
	}
	if len(descriptor.WorldBook) == 0 {
		return shareWorldBookPackageDescriptor{}, ErrShareInvalidWorldBookPackage
	}
	return descriptor, nil
}

func mergeShareWorldBookDescriptor(view ShareWorldBookView, descriptor shareWorldBookPackageDescriptor) ShareWorldBookView {
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
		view.Tags = normalizeShareWorldBookTags(descriptor.Tags)
	}
	if len(view.Tags) == 0 {
		view.Tags = []string{"world_book"}
	}
	view.EntryCount = len(descriptor.WorldBook)
	return view
}

func normalizeShareWorldBookTags(tags []string) []string {
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

func validateAndCloneShareWorldBookReader(fileName string, reader io.Reader) (io.Reader, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}

	data, err := io.ReadAll(io.LimitReader(reader, shareWorldBookMaxReadBytes+1))
	if err != nil {
		return nil, ErrShareInvalidWorldBookPackage
	}
	if len(data) == 0 {
		return nil, ErrShareFileRequired
	}
	if len(data) > shareWorldBookMaxReadBytes {
		return nil, ErrShareWorldBookPackageTooLarge
	}
	if _, err := inspectShareWorldBookPackage(data); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (s *ShareService) loadCardWorldBookView(ctx context.Context, card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) (*ShareWorldBookView, error) {
	asset := findShareCardAssetBySlot(assets, "world_book")
	if asset == nil {
		return nil, nil
	}

	view, err := s.buildWorldBookView(ctx, card, asset)
	if err != nil {
		return nil, err
	}
	return &view, nil
}
