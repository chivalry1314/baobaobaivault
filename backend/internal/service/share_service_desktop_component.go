package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/cache"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"golang.org/x/net/html"
	"gorm.io/gorm"
)

const (
	shareDesktopComponentProtocol     = "baobaobaiphone.desktop-component.v1"
	shareDesktopComponentMaxReadBytes = 2 * 1024 * 1024
)

var (
	shareDesktopComponentExts = map[string]struct{}{
		".html": {},
		".htm":  {},
	}
)

type ShareDesktopComponentView struct {
	Protocol           string `json:"protocol"`
	Format             string `json:"format"`
	Supported          bool   `json:"supported"`
	Name               string `json:"name"`
	Width              int    `json:"width"`
	Height             int    `json:"height"`
	CornerRadius       int    `json:"cornerRadius"`
	Frosted            int    `json:"frosted"`
	Shadow             int    `json:"shadow"`
	BackgroundOpacity  int    `json:"backgroundOpacity"`
	FileName           string `json:"fileName"`
	MimeType           string `json:"mimeType"`
	Size               int64  `json:"size"`
}

type ShareDiscoverDesktopComponentItem struct {
	Card             ShareCardView              `json:"card"`
	Creator          SharePublicUser            `json:"creator"`
	Stats            ShareCardStats             `json:"stats"`
	Asset            ShareCardAssetView         `json:"asset"`
	DesktopComponent ShareDesktopComponentView  `json:"desktopComponent"`
	AccessCodeStatus ShareCardAccessStatus      `json:"accessCodeStatus"`
}

type shareDesktopComponentMetadata struct {
	Name              string
	Width             int
	Height            int
	CornerRadius      int
	Frosted           int
	Shadow            int
	BackgroundOpacity int
}

func (s *ShareService) ListDiscoverDesktopComponents(ctx context.Context, page, size int) ([]ShareDiscoverDesktopComponentItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	cacheKey := cache.Key("discover", "desktop_components", fmt.Sprintf("%d", page), fmt.Sprintf("%d", size))
	var cached struct {
		Items []ShareDiscoverDesktopComponentItem `json:"items"`
		Total int64                               `json:"total"`
	}
	if s.cache.Get(ctx, cacheKey, &cached) {
		return cached.Items, cached.Total, nil
	}

	baseQuery := func() *gorm.DB {
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", "desktop_component").
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
			Items []ShareDiscoverDesktopComponentItem `json:"items"`
			Total int64                             `json:"total"`
		}{Items: []ShareDiscoverDesktopComponentItem{}, Total: 0}, 60*time.Second)
		return []ShareDiscoverDesktopComponentItem{}, 0, nil
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
			Items []ShareDiscoverDesktopComponentItem `json:"items"`
			Total int64                             `json:"total"`
		}{Items: []ShareDiscoverDesktopComponentItem{}, Total: total}, 60*time.Second)
		return []ShareDiscoverDesktopComponentItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverDesktopComponents(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	_ = s.cache.Set(ctx, cacheKey, struct {
		Items []ShareDiscoverDesktopComponentItem `json:"items"`
		Total int64                             `json:"total"`
	}{Items: items, Total: total}, 60*time.Second)
	return items, total, nil
}

func (s *ShareService) mapDiscoverDesktopComponents(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverDesktopComponentItem, error) {
	if len(cards) == 0 {
		return []ShareDiscoverDesktopComponentItem{}, nil
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
	items := make([]ShareDiscoverDesktopComponentItem, 0, len(cards))
	for _, card := range cards {
		assets := assetsByCardID[card.ID]
		componentAsset := findShareCardAssetBySlot(assets, "desktop_component")
		if componentAsset == nil {
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

		desktopComponent, err := s.buildDesktopComponentView(ctx, &card, componentAsset)
		if err != nil {
			return nil, err
		}

		items = append(items, ShareDiscoverDesktopComponentItem{
			Card:             toShareCardView(&card, assets),
			Creator:          creatorView,
			Stats:            statsByCard[card.ID],
			Asset:            buildShareCardAssetView(card.ID, *componentAsset),
			DesktopComponent: desktopComponent,
			AccessCodeStatus: deriveShareCardAccessStatus(&card, false),
		})
	}

	return items, nil
}

func (s *ShareService) buildDesktopComponentView(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (ShareDesktopComponentView, error) {
	view := ShareDesktopComponentView{
		Protocol:          shareDesktopComponentProtocol,
		Format:            detectShareDesktopComponentFormat(asset.OriginalFileName, asset.MimeType),
		Supported:         false,
		Name:              strings.TrimSpace(card.Title),
		Width:             2,
		Height:            2,
		CornerRadius:      22,
		Frosted:           8,
		Shadow:            12,
		BackgroundOpacity: 0,
		FileName:          strings.TrimSpace(asset.OriginalFileName),
		MimeType:          strings.TrimSpace(asset.MimeType),
		Size:              asset.Size,
	}

	if card == nil || asset == nil {
		return view, nil
	}

	if asset.Size <= 0 || asset.Size > shareDesktopComponentMaxReadBytes {
		return view, nil
	}

	reader, _, err := s.OpenCardFile(ctx, card, asset)
	if err != nil {
		return view, nil
	}
	defer reader.Close()

	limited := io.LimitReader(reader, shareDesktopComponentMaxReadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil || len(data) == 0 || len(data) > shareDesktopComponentMaxReadBytes {
		return view, nil
	}

	metadata, err := inspectShareDesktopComponent(data)
	if err != nil {
		return view, nil
	}

	view.Supported = true
	if metadata.Name != "" {
		view.Name = metadata.Name
	}
	if metadata.Width > 0 {
		view.Width = metadata.Width
	}
	if metadata.Height > 0 {
		view.Height = metadata.Height
	}
	if metadata.CornerRadius > 0 {
		view.CornerRadius = metadata.CornerRadius
	}
	if metadata.Frosted > 0 {
		view.Frosted = metadata.Frosted
	}
	if metadata.Shadow > 0 {
		view.Shadow = metadata.Shadow
	}
	if metadata.BackgroundOpacity >= 0 {
		view.BackgroundOpacity = metadata.BackgroundOpacity
	}

	return view, nil
}

func detectShareDesktopComponentFormat(fileName, mimeType string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	switch ext {
	case ".html", ".htm":
		return "html"
	}

	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch mimeType {
	case "text/html", "application/html":
		return "html"
	default:
		return "unknown"
	}
}

func inspectShareDesktopComponent(data []byte) (shareDesktopComponentMetadata, error) {
	if len(data) == 0 {
		return shareDesktopComponentMetadata{}, ErrShareInvalidDesktopComponent
	}

	// Ensure the uploaded file at least declares itself as an HTML document.
	lower := strings.ToLower(string(data))
	if !strings.Contains(lower, "<html") && !strings.Contains(lower, "<body") {
		return shareDesktopComponentMetadata{}, ErrShareInvalidDesktopComponent
	}

	doc, err := html.Parse(bytes.NewReader(data))
	if err != nil {
		return shareDesktopComponentMetadata{}, ErrShareInvalidDesktopComponent
	}

	metadata := shareDesktopComponentMetadata{
		Width:             2,
		Height:            2,
		CornerRadius:      22,
		Frosted:           8,
		Shadow:            12,
		BackgroundOpacity: -1,
	}

	hasHTML := false
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n == nil {
			return
		}
		if n.Type == html.ElementNode {
			switch strings.ToLower(n.Data) {
			case "html", "body":
				hasHTML = true
			case "meta":
				var name, content string
				for _, attr := range n.Attr {
					key := strings.ToLower(attr.Key)
					if key == "name" {
						name = strings.TrimSpace(attr.Val)
					}
					if key == "content" {
						content = strings.TrimSpace(attr.Val)
					}
				}
				fillDesktopComponentMetadata(&metadata, name, content)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)

	if !hasHTML {
		return shareDesktopComponentMetadata{}, ErrShareInvalidDesktopComponent
	}

	if metadata.Width < 1 {
		metadata.Width = 2
	}
	if metadata.Width > 4 {
		metadata.Width = 4
	}
	if metadata.Height < 1 {
		metadata.Height = 1
	}
	if metadata.Height > 6 {
		metadata.Height = 6
	}
	if metadata.CornerRadius <= 0 {
		metadata.CornerRadius = 22
	}
	if metadata.Frosted <= 0 {
		metadata.Frosted = 8
	}
	if metadata.Shadow <= 0 {
		metadata.Shadow = 12
	}
	if metadata.BackgroundOpacity < 0 {
		metadata.BackgroundOpacity = 0
	}
	if metadata.BackgroundOpacity > 100 {
		metadata.BackgroundOpacity = 100
	}

	return metadata, nil
}

func fillDesktopComponentMetadata(metadata *shareDesktopComponentMetadata, name, content string) {
	switch strings.ToLower(name) {
	case "widget-name":
		metadata.Name = content
	case "widget-width":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.Width = v
		}
	case "widget-height":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.Height = v
		}
	case "widget-corner-radius":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.CornerRadius = v
		}
	case "widget-frosted":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.Frosted = v
		}
	case "widget-shadow":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.Shadow = v
		}
	case "widget-background-opacity":
		if v, err := strconv.Atoi(content); err == nil {
			metadata.BackgroundOpacity = v
		}
	}
}

func validateAndCloneShareDesktopComponentReader(fileName string, reader io.Reader) (io.Reader, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}

	format := detectShareDesktopComponentFormat(fileName, "")
	if format != "html" {
		return nil, ErrShareInvalidDesktopComponent
	}

	data, err := io.ReadAll(io.LimitReader(reader, shareDesktopComponentMaxReadBytes+1))
	if err != nil {
		return nil, ErrShareInvalidDesktopComponent
	}
	if len(data) == 0 {
		return nil, ErrShareFileRequired
	}
	if len(data) > shareDesktopComponentMaxReadBytes {
		return nil, ErrShareDesktopComponentTooLarge
	}
	if _, err := inspectShareDesktopComponent(data); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (s *ShareService) loadCardDesktopComponentView(ctx context.Context, card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) (*ShareDesktopComponentView, error) {
	asset := findShareCardAssetBySlot(assets, "desktop_component")
	if asset == nil {
		return nil, nil
	}

	view, err := s.buildDesktopComponentView(ctx, card, asset)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func isShareDesktopComponentCard(ctx context.Context, db *gorm.DB, cardID string) (bool, error) {
	var count int64
	if err := db.WithContext(ctx).
		Model(&model.SharePlatformCardAsset{}).
		Where("card_id = ? AND slot = ?", strings.TrimSpace(cardID), "desktop_component").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
