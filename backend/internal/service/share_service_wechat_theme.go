package service

import (
	"archive/zip"
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
	shareWechatThemeProtocol     = "baobaobaiphone.wechat-theme-package.v1"
	shareWechatThemeMaxReadBytes = 24 * 1024 * 1024
	shareWechatThemeMaxZipFiles  = 50
)

var (
	shareWechatThemeImageExts = map[string]struct{}{
		".png":  {},
		".jpg":  {},
		".jpeg": {},
		".webp": {},
		".svg":  {},
		".gif":  {},
	}
	shareWechatThemeValidBubblePresets = map[string]struct{}{
		"wechat": {},
		"rounded": {},
		"glass":   {},
		"outline": {},
	}
)

type ShareWechatThemeView struct {
	Protocol           string   `json:"protocol"`
	ID                 string   `json:"id"`
	Format             string   `json:"format"`
	Supported          bool     `json:"supported"`
	Name               string   `json:"name"`
	Author             string   `json:"author"`
	Version            string   `json:"version"`
	Description        string   `json:"description"`
	Tags               []string `json:"tags"`
	ChatBackgroundImage string  `json:"chatBackgroundImage"`
	ChatBackgroundOpacity float64 `json:"chatBackgroundOpacity"`
	SelfBubblePreset   string   `json:"selfBubblePreset"`
	PeerBubblePreset   string   `json:"peerBubblePreset"`
	RendererSource     string   `json:"rendererSource"`
	FileName           string   `json:"fileName"`
	MimeType           string   `json:"mimeType"`
	Size               int64    `json:"size"`
}

type ShareDiscoverWechatThemeItem struct {
	Card             ShareCardView         `json:"card"`
	Creator          SharePublicUser       `json:"creator"`
	Stats            ShareCardStats        `json:"stats"`
	Asset            ShareCardAssetView    `json:"asset"`
	WechatTheme      ShareWechatThemeView  `json:"wechatTheme"`
	AccessCodeStatus ShareCardAccessStatus `json:"accessCodeStatus"`
}

type shareWechatThemePackageDescriptor struct {
	ID                    string   `json:"id"`
	Name                  string   `json:"name"`
	Author                string   `json:"author"`
	Version               string   `json:"version"`
	Description           string   `json:"description"`
	Tags                  []string `json:"tags"`
	ChatBackgroundImage   string   `json:"chatBackgroundImage"`
	ChatBackgroundOpacity float64  `json:"chatBackgroundOpacity"`
	SelfBubblePreset      string   `json:"selfBubblePreset"`
	PeerBubblePreset      string   `json:"peerBubblePreset"`
	RendererSource        string   `json:"rendererSource"`
}

func (s *ShareService) ListDiscoverWechatThemes(ctx context.Context, page, size int) ([]ShareDiscoverWechatThemeItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	cacheKey := cache.Key("discover", "wechat_themes", fmt.Sprintf("%d", page), fmt.Sprintf("%d", size))
	var cached struct {
		Items []ShareDiscoverWechatThemeItem `json:"items"`
		Total int64                          `json:"total"`
	}
	if s.cache.Get(ctx, cacheKey, &cached) {
		return cached.Items, cached.Total, nil
	}

	baseQuery := func() *gorm.DB {
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", "wechat_theme").
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
			Items []ShareDiscoverWechatThemeItem `json:"items"`
			Total int64                          `json:"total"`
		}{Items: []ShareDiscoverWechatThemeItem{}, Total: 0}, 60*time.Second)
		return []ShareDiscoverWechatThemeItem{}, 0, nil
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
			Items []ShareDiscoverWechatThemeItem `json:"items"`
			Total int64                          `json:"total"`
		}{Items: []ShareDiscoverWechatThemeItem{}, Total: total}, 60*time.Second)
		return []ShareDiscoverWechatThemeItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverWechatThemes(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	_ = s.cache.Set(ctx, cacheKey, struct {
		Items []ShareDiscoverWechatThemeItem `json:"items"`
		Total int64                          `json:"total"`
	}{Items: items, Total: total}, 60*time.Second)
	return items, total, nil
}

func (s *ShareService) mapDiscoverWechatThemes(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverWechatThemeItem, error) {
	if len(cards) == 0 {
		return []ShareDiscoverWechatThemeItem{}, nil
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
	items := make([]ShareDiscoverWechatThemeItem, 0, len(cards))
	for _, card := range cards {
		assets := assetsByCardID[card.ID]
		wechatAsset := findShareCardAssetBySlot(assets, "wechat_theme")
		if wechatAsset == nil {
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

		creatorName := ""
		if creator, exists := creatorMap[card.CreatorExternalUserID]; exists {
			creatorName = strings.TrimSpace(creator.Nickname)
			if creatorName == "" {
				creatorName = strings.TrimSpace(creator.Username)
			}
		}
		wechatTheme, err := s.buildWechatThemeView(ctx, &card, wechatAsset, creatorName)
		if err != nil {
			return nil, err
		}

		items = append(items, ShareDiscoverWechatThemeItem{
			Card:             toShareCardView(&card, assets),
			Creator:          creatorView,
			Stats:            statsByCard[card.ID],
			Asset:            buildShareCardAssetView(card.ID, *wechatAsset),
			WechatTheme:      wechatTheme,
			AccessCodeStatus: deriveShareCardAccessStatus(&card, false),
		})
	}

	return items, nil
}

func (s *ShareService) buildWechatThemeView(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset, creatorName string) (ShareWechatThemeView, error) {
	view := ShareWechatThemeView{
		Protocol:              shareWechatThemeProtocol,
		ID:                    strings.TrimSpace(card.ID),
		Format:                detectShareWechatThemeFormat(asset.OriginalFileName, asset.MimeType),
		Supported:             false,
		Name:                  strings.TrimSpace(card.Title),
		Author:                strings.TrimSpace(creatorName),
		Version:               "",
		Description:           strings.TrimSpace(card.Description),
		Tags:                  append([]string{}, decodeShareCardTags(card.TagsText)...),
		ChatBackgroundImage:   "",
		ChatBackgroundOpacity: 0,
		SelfBubblePreset:      "wechat",
		PeerBubblePreset:      "wechat",
		RendererSource:        "",
		FileName:              strings.TrimSpace(asset.OriginalFileName),
		MimeType:              strings.TrimSpace(asset.MimeType),
		Size:                  asset.Size,
	}

	if card == nil || asset == nil {
		return view, nil
	}

	if asset.Size <= 0 || asset.Size > shareWechatThemeMaxReadBytes {
		return view, nil
	}

	reader, _, err := s.OpenCardFile(ctx, card, asset)
	if err != nil {
		return view, nil
	}
	defer reader.Close()

	limited := io.LimitReader(reader, shareWechatThemeMaxReadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil || len(data) == 0 || len(data) > shareWechatThemeMaxReadBytes {
		return view, nil
	}

	descriptor, err := inspectShareWechatThemePackage(strings.TrimSpace(asset.OriginalFileName), data)
	if err != nil {
		return view, nil
	}

	return mergeShareWechatThemeDescriptor(view, descriptor), nil
}

func mergeShareWechatThemeDescriptor(view ShareWechatThemeView, descriptor shareWechatThemePackageDescriptor) ShareWechatThemeView {
	view.Supported = true
	if id := strings.TrimSpace(descriptor.ID); id != "" {
		view.ID = id
	}
	if name := strings.TrimSpace(descriptor.Name); name != "" && view.Name == "" {
		view.Name = name
	}
	if author := strings.TrimSpace(descriptor.Author); author != "" {
		view.Author = author
	}
	if version := strings.TrimSpace(descriptor.Version); version != "" {
		view.Version = version
	}
	if description := strings.TrimSpace(descriptor.Description); description != "" && view.Description == "" {
		view.Description = description
	}
	if len(descriptor.Tags) > 0 && len(view.Tags) == 0 {
		view.Tags = descriptor.Tags
	}
	if image := strings.TrimSpace(descriptor.ChatBackgroundImage); image != "" {
		view.ChatBackgroundImage = image
	}
	if descriptor.ChatBackgroundOpacity >= 0 && descriptor.ChatBackgroundOpacity <= 1 {
		view.ChatBackgroundOpacity = descriptor.ChatBackgroundOpacity
	}
	if preset := strings.TrimSpace(descriptor.SelfBubblePreset); isValidWechatBubblePreset(preset) {
		view.SelfBubblePreset = preset
	}
	if preset := strings.TrimSpace(descriptor.PeerBubblePreset); isValidWechatBubblePreset(preset) {
		view.PeerBubblePreset = preset
	}
	if source := strings.TrimSpace(descriptor.RendererSource); source != "" {
		view.RendererSource = source
	}
	return view
}

func inspectShareWechatThemePackage(fileName string, data []byte) (shareWechatThemePackageDescriptor, error) {
	format := detectShareWechatThemeFormat(fileName, "")
	switch format {
	case "json":
		descriptor, err := decodeShareWechatThemePackageDescriptor(data)
		if err != nil {
			return shareWechatThemePackageDescriptor{}, err
		}
		return descriptor, nil
	case "zip":
		return inspectShareWechatThemeZipPackage(data)
	default:
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}
}

func decodeShareWechatThemePackageDescriptor(data []byte) (shareWechatThemePackageDescriptor, error) {
	var descriptor shareWechatThemePackageDescriptor
	if err := json.Unmarshal(data, &descriptor); err != nil {
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}
	descriptor.ID = strings.TrimSpace(descriptor.ID)
	descriptor.Name = strings.TrimSpace(descriptor.Name)
	descriptor.Author = strings.TrimSpace(descriptor.Author)
	descriptor.Version = strings.TrimSpace(descriptor.Version)
	descriptor.Description = strings.TrimSpace(descriptor.Description)
	descriptor.Tags = normalizeShareWechatThemeTags(descriptor.Tags)
	descriptor.ChatBackgroundImage = strings.TrimSpace(descriptor.ChatBackgroundImage)
	descriptor.SelfBubblePreset = strings.ToLower(strings.TrimSpace(descriptor.SelfBubblePreset))
	descriptor.PeerBubblePreset = strings.ToLower(strings.TrimSpace(descriptor.PeerBubblePreset))
	if !isValidWechatBubblePreset(descriptor.SelfBubblePreset) {
		descriptor.SelfBubblePreset = "wechat"
	}
	if !isValidWechatBubblePreset(descriptor.PeerBubblePreset) {
		descriptor.PeerBubblePreset = "wechat"
	}
	if descriptor.ChatBackgroundOpacity < 0 || descriptor.ChatBackgroundOpacity > 1 {
		descriptor.ChatBackgroundOpacity = 0
	}
	descriptor.RendererSource = strings.TrimSpace(descriptor.RendererSource)
	return descriptor, nil
}

func detectShareWechatThemeFormat(fileName, mimeType string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	switch ext {
	case ".zip":
		return "zip"
	case ".json":
		return "json"
	}

	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch mimeType {
	case "application/zip", "application/x-zip-compressed":
		return "zip"
	case "application/json", "text/json":
		return "json"
	default:
		return "unknown"
	}
}

func inspectShareWechatThemeZipPackage(data []byte) (shareWechatThemePackageDescriptor, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}

	files := make([]*zip.File, 0, len(reader.File))
	entryMap := make(map[string]*zip.File, len(reader.File))
	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		files = append(files, file)
		entryMap[normalizeShareWechatThemeZipPath(file.Name)] = file
	}
	if len(files) == 0 || len(files) > shareWechatThemeMaxZipFiles {
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}

	manifestFile := findShareWechatThemeManifestFile(files)
	if manifestFile == nil {
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}

	manifestData, err := readWechatThemeZipFile(manifestFile, shareWechatThemeMaxReadBytes)
	if err != nil {
		return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
	}
	descriptor, err := decodeShareWechatThemePackageDescriptor(manifestData)
	if err != nil {
		return shareWechatThemePackageDescriptor{}, err
	}
	manifestDir := shareWechatThemeDir(normalizeShareWechatThemeZipPath(manifestFile.Name))

	if descriptor.ChatBackgroundImage != "" {
		if !shareWechatThemeAssetExists(manifestDir, descriptor.ChatBackgroundImage, entryMap) {
			return shareWechatThemePackageDescriptor{}, ErrShareInvalidWechatThemePackage
		}
	}

	return descriptor, nil
}

func findShareWechatThemeManifestFile(files []*zip.File) *zip.File {
	for _, file := range files {
		name := normalizeShareWechatThemeZipPath(file.Name)
		if name == "manifest.json" || name == "theme.json" || strings.HasSuffix(name, "/manifest.json") || strings.HasSuffix(name, "/theme.json") {
			return file
		}
	}
	return nil
}

func readWechatThemeZipFile(file *zip.File, maxBytes int64) ([]byte, error) {
	stream, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	data, err := io.ReadAll(io.LimitReader(stream, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, ErrShareInvalidWechatThemePackage
	}
	return data, nil
}

func shareWechatThemeDir(path string) string {
	index := strings.LastIndex(path, "/")
	if index < 0 {
		return ""
	}
	return path[:index]
}

func shareWechatThemeAssetExists(baseDir, assetPath string, entryMap map[string]*zip.File) bool {
	trimmed := strings.TrimSpace(assetPath)
	if trimmed == "" {
		return false
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "data:") {
		return true
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "http://") || strings.HasPrefix(strings.ToLower(trimmed), "https://") {
		return false
	}

	combined := trimmed
	if baseDir != "" {
		combined = baseDir + "/" + trimmed
	}
	segments := strings.Split(strings.ReplaceAll(combined, "\\", "/"), "/")
	resolved := make([]string, 0, len(segments))
	for _, raw := range segments {
		part := strings.TrimSpace(raw)
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			if len(resolved) == 0 {
				return false
			}
			resolved = resolved[:len(resolved)-1]
			continue
		}
		resolved = append(resolved, part)
	}
	if len(resolved) == 0 {
		return false
	}
	resolvedPath := strings.ToLower(strings.Join(resolved, "/"))
	entry, exists := entryMap[resolvedPath]
	if !exists {
		return false
	}
	ext := strings.ToLower(filepath.Ext(resolvedPath))
	_, ok := shareWechatThemeImageExts[ext]
	if ok {
		return true
	}
	return !entry.FileInfo().IsDir()
}

func normalizeShareWechatThemeTags(tags []string) []string {
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

func normalizeShareWechatThemeZipPath(path string) string {
	return strings.ToLower(strings.TrimSpace(strings.ReplaceAll(path, "\\", "/")))
}

func isValidWechatBubblePreset(preset string) bool {
	_, ok := shareWechatThemeValidBubblePresets[preset]
	return ok
}

func validateAndCloneShareWechatThemeReader(fileName string, reader io.Reader) (io.Reader, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}

	data, err := io.ReadAll(io.LimitReader(reader, shareWechatThemeMaxReadBytes+1))
	if err != nil {
		return nil, ErrShareInvalidWechatThemePackage
	}
	if len(data) == 0 {
		return nil, ErrShareFileRequired
	}
	if len(data) > shareWechatThemeMaxReadBytes {
		return nil, ErrShareWechatThemePackageTooLarge
	}
	if _, err := inspectShareWechatThemePackage(fileName, data); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (s *ShareService) loadCardWechatThemeView(ctx context.Context, card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) (*ShareWechatThemeView, error) {
	asset := findShareCardAssetBySlot(assets, "wechat_theme")
	if asset == nil {
		return nil, nil
	}

	creatorName := ""
	if card != nil {
		var creator model.ShareExternalUser
		if err := s.db.WithContext(ctx).Where("id = ?", card.CreatorExternalUserID).First(&creator).Error; err == nil {
			creatorName = strings.TrimSpace(creator.Nickname)
			if creatorName == "" {
				creatorName = strings.TrimSpace(creator.Username)
			}
		}
	}

	view, err := s.buildWechatThemeView(ctx, card, asset, creatorName)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func isShareWechatThemeCard(ctx context.Context, db *gorm.DB, cardID string) (bool, error) {
	var count int64
	if err := db.WithContext(ctx).
		Model(&model.SharePlatformCardAsset{}).
		Where("card_id = ? AND slot = ?", strings.TrimSpace(cardID), "wechat_theme").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
