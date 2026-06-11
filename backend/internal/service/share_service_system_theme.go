package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"path/filepath"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

const (
	shareSystemThemeProtocol     = "baobaobaiphone.system-theme-package.v1"
	shareSystemThemeMaxReadBytes = 24 * 1024 * 1024
	shareSystemThemeMaxZipFiles  = 200
	shareSystemThemeManifestMax  = shareSystemThemeMaxReadBytes
	shareSystemThemeTokensMax    = shareSystemThemeMaxReadBytes
)

var (
	shareSystemThemeImageExts = map[string]struct{}{
		".png":  {},
		".jpg":  {},
		".jpeg": {},
		".webp": {},
		".svg":  {},
		".gif":  {},
	}
	shareSystemThemeFontExts = map[string]struct{}{
		".woff2": {},
		".woff":  {},
		".ttf":   {},
		".otf":   {},
	}
)

type ShareSystemThemeView struct {
	Protocol    string   `json:"protocol"`
	ID          string   `json:"id"`
	Format      string   `json:"format"`
	Supported   bool     `json:"supported"`
	Name        string   `json:"name"`
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	FileName    string   `json:"fileName"`
	MimeType    string   `json:"mimeType"`
	Size        int64    `json:"size"`
}

type ShareDiscoverSystemThemeItem struct {
	Card             ShareCardView         `json:"card"`
	Creator          SharePublicUser       `json:"creator"`
	Stats            ShareCardStats        `json:"stats"`
	Asset            ShareCardAssetView    `json:"asset"`
	SystemTheme      ShareSystemThemeView  `json:"systemTheme"`
	AccessCodeStatus ShareCardAccessStatus `json:"accessCodeStatus"`
}

type shareThemePackageManifest struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

type shareThemePackageFontRef struct {
	File string `json:"file"`
}

type shareThemePackageDescriptor struct {
	ID            string                    `json:"id"`
	Name          string                    `json:"name"`
	Author        string                    `json:"author"`
	Version       string                    `json:"version"`
	Description   string                    `json:"description"`
	Tags          []string                  `json:"tags"`
	CoverImage    string                    `json:"coverImage"`
	PreviewImages []string                  `json:"previewImages"`
	Wallpaper     string                    `json:"wallpaper"`
	IconPack      map[string]string         `json:"iconPack"`
	CustomFont    *shareThemePackageFontRef `json:"customFont"`
	DesktopLayout json.RawMessage           `json:"desktopLayout"`
	DesktopIcons  json.RawMessage           `json:"desktopIcons"`
	SettingsPatch json.RawMessage           `json:"settingsPatch"`
	ThemeTokens   json.RawMessage           `json:"themeTokens"`
	Tokens        string                    `json:"tokens"`
}

func (s *ShareService) ListDiscoverSystemThemes(ctx context.Context, page, size int) ([]ShareDiscoverSystemThemeItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	baseQuery := func() *gorm.DB {
		return s.db.WithContext(ctx).
			Model(&model.SharePlatformCard{}).
			Joins("JOIN share_platform_card_assets ON share_platform_card_assets.card_id = share_platform_cards.id AND share_platform_card_assets.slot = ?", "system_theme").
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
		return []ShareDiscoverSystemThemeItem{}, 0, nil
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
		return []ShareDiscoverSystemThemeItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverSystemThemes(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *ShareService) mapDiscoverSystemThemes(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverSystemThemeItem, error) {
	if len(cards) == 0 {
		return []ShareDiscoverSystemThemeItem{}, nil
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

	statsByCard, _ := aggregateStatsFromCards(cards)
	items := make([]ShareDiscoverSystemThemeItem, 0, len(cards))
	for _, card := range cards {
		assets := assetsByCardID[card.ID]
		systemAsset := findShareCardAssetBySlot(assets, "system_theme")
		if systemAsset == nil {
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

		systemTheme, err := s.buildSystemThemeView(ctx, &card, systemAsset)
		if err != nil {
			return nil, err
		}

		items = append(items, ShareDiscoverSystemThemeItem{
			Card:             toShareCardView(&card, assets),
			Creator:          creatorView,
			Stats:            statsByCard[card.ID],
			Asset:            buildShareCardAssetView(card.ID, *systemAsset),
			SystemTheme:      systemTheme,
			AccessCodeStatus: deriveShareCardAccessStatus(&card, false),
		})
	}

	return items, nil
}

func (s *ShareService) buildSystemThemeView(ctx context.Context, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (ShareSystemThemeView, error) {
	view := ShareSystemThemeView{
		Protocol:    shareSystemThemeProtocol,
		ID:          strings.TrimSpace(card.ID),
		Format:      detectShareSystemThemeFormat(asset.OriginalFileName, asset.MimeType),
		Supported:   false,
		Name:        strings.TrimSpace(card.Title),
		Author:      "",
		Version:     "",
		Description: strings.TrimSpace(card.Description),
		Tags:        append([]string{}, decodeShareCardTags(card.TagsText)...),
		FileName:    strings.TrimSpace(asset.OriginalFileName),
		MimeType:    strings.TrimSpace(asset.MimeType),
		Size:        asset.Size,
	}
	if len(view.Tags) == 0 {
		view.Tags = []string{"system_theme"}
	}

	if card == nil || asset == nil {
		return view, nil
	}

	if asset.Size <= 0 || asset.Size > shareSystemThemeMaxReadBytes {
		return view, nil
	}

	reader, _, err := s.OpenCardFile(ctx, card, asset)
	if err != nil {
		return view, nil
	}
	defer reader.Close()

	limited := io.LimitReader(reader, shareSystemThemeMaxReadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil || len(data) == 0 || len(data) > shareSystemThemeMaxReadBytes {
		return view, nil
	}

	manifest, err := inspectShareThemePackage(strings.TrimSpace(asset.OriginalFileName), data)
	if err != nil {
		return view, nil
	}

	return mergeShareSystemThemeManifest(view, manifest), nil
}

func mergeShareSystemThemeManifest(view ShareSystemThemeView, manifest shareThemePackageManifest) ShareSystemThemeView {
	view.Supported = strings.TrimSpace(manifest.Name) != ""
	if themeID := strings.TrimSpace(manifest.ID); themeID != "" {
		view.ID = themeID
	}
	if name := strings.TrimSpace(manifest.Name); name != "" && view.Name == "" {
		view.Name = name
	}
	if author := strings.TrimSpace(manifest.Author); author != "" {
		view.Author = author
	}
	if version := strings.TrimSpace(manifest.Version); version != "" {
		view.Version = version
	}
	if description := strings.TrimSpace(manifest.Description); description != "" && view.Description == "" {
		view.Description = description
	}
	if len(manifest.Tags) > 0 && len(view.Tags) == 0 {
		view.Tags = manifest.Tags
	}
	return view
}

func inspectShareThemePackage(fileName string, data []byte) (shareThemePackageManifest, error) {
	format := detectShareSystemThemeFormat(fileName, "")
	switch format {
	case "json":
		descriptor, err := decodeShareThemePackageDescriptor(data)
		if err != nil {
			return shareThemePackageManifest{}, err
		}
		if strings.TrimSpace(descriptor.Name) == "" {
			return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
		}
		return descriptor.toManifest(), nil
	case "zip":
		return inspectShareThemeZipPackage(data)
	default:
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}
}

func decodeShareThemePackageDescriptor(data []byte) (shareThemePackageDescriptor, error) {
	var descriptor shareThemePackageDescriptor
	if err := json.Unmarshal(data, &descriptor); err != nil {
		return shareThemePackageDescriptor{}, ErrShareInvalidSystemThemePackage
	}
	descriptor.ID = strings.TrimSpace(descriptor.ID)
	descriptor.Name = strings.TrimSpace(descriptor.Name)
	descriptor.Author = strings.TrimSpace(descriptor.Author)
	descriptor.Version = strings.TrimSpace(descriptor.Version)
	descriptor.Description = strings.TrimSpace(descriptor.Description)
	descriptor.Tags = normalizeShareThemeTags(descriptor.Tags)
	descriptor.CoverImage = strings.TrimSpace(descriptor.CoverImage)
	descriptor.Wallpaper = strings.TrimSpace(descriptor.Wallpaper)
	descriptor.Tokens = strings.TrimSpace(descriptor.Tokens)
	if len(descriptor.PreviewImages) > 0 {
		nextPreviews := make([]string, 0, len(descriptor.PreviewImages))
		for _, item := range descriptor.PreviewImages {
			value := strings.TrimSpace(item)
			if value == "" {
				continue
			}
			nextPreviews = append(nextPreviews, value)
		}
		descriptor.PreviewImages = nextPreviews
	}
	if descriptor.IconPack != nil {
		nextIconPack := make(map[string]string, len(descriptor.IconPack))
		for appID, assetPath := range descriptor.IconPack {
			normalizedAppID := strings.TrimSpace(appID)
			normalizedPath := strings.TrimSpace(assetPath)
			if normalizedAppID == "" || normalizedPath == "" {
				continue
			}
			nextIconPack[normalizedAppID] = normalizedPath
		}
		descriptor.IconPack = nextIconPack
	}
	if descriptor.CustomFont != nil {
		descriptor.CustomFont.File = strings.TrimSpace(descriptor.CustomFont.File)
	}
	return descriptor, nil
}

func detectShareSystemThemeFormat(fileName, mimeType string) string {
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

func inspectShareThemeZipPackage(data []byte) (shareThemePackageManifest, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}

	files := make([]*zip.File, 0, len(reader.File))
	entryMap := make(map[string]*zip.File, len(reader.File))
	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		files = append(files, file)
		entryMap[normalizeShareThemeZipPath(file.Name)] = file
	}
	if len(files) == 0 || len(files) > shareSystemThemeMaxZipFiles {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}

	manifestFile := findShareThemeManifestFile(files)
	if manifestFile == nil {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}

	manifestData, err := readZipFile(manifestFile, shareSystemThemeManifestMax)
	if err != nil {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}
	manifestDescriptor, err := decodeShareThemePackageDescriptor(manifestData)
	if err != nil {
		return shareThemePackageManifest{}, err
	}
	manifestDir := shareThemeDir(normalizeShareThemeZipPath(manifestFile.Name))

	mergedDescriptor := manifestDescriptor
	if manifestDescriptor.Tokens != "" {
		tokenPath, resolveErr := resolveShareThemeAssetPath(manifestDir, manifestDescriptor.Tokens)
		if resolveErr != nil {
			return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
		}
		tokenFile, exists := entryMap[tokenPath]
		if !exists {
			return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
		}
		tokenData, readErr := readZipFile(tokenFile, shareSystemThemeTokensMax)
		if readErr != nil {
			return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
		}
		tokenDescriptor, decodeErr := decodeShareThemePackageDescriptor(tokenData)
		if decodeErr != nil {
			return shareThemePackageManifest{}, decodeErr
		}
		mergedDescriptor = mergeShareThemeDescriptors(tokenDescriptor, manifestDescriptor)
	}

	if strings.TrimSpace(mergedDescriptor.Name) == "" {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}

	if !validateShareThemeDescriptorAssets(manifestDir, mergedDescriptor, entryMap) {
		return shareThemePackageManifest{}, ErrShareInvalidSystemThemePackage
	}

	return mergedDescriptor.toManifest(), nil
}

func findShareThemeManifestFile(files []*zip.File) *zip.File {
	for _, file := range files {
		name := normalizeShareThemeZipPath(file.Name)
		if name == "manifest.json" || name == "theme.json" || strings.HasSuffix(name, "/manifest.json") || strings.HasSuffix(name, "/theme.json") {
			return file
		}
	}
	return nil
}

func readZipFile(file *zip.File, maxBytes int64) ([]byte, error) {
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
		return nil, ErrShareInvalidSystemThemePackage
	}
	return data, nil
}

func shareThemeDir(path string) string {
	index := strings.LastIndex(path, "/")
	if index < 0 {
		return ""
	}
	return path[:index]
}

func resolveShareThemeAssetPath(baseDir, target string) (string, error) {
	target = strings.TrimSpace(target)
	if target == "" || strings.HasPrefix(strings.ToLower(target), "http://") || strings.HasPrefix(strings.ToLower(target), "https://") {
		return "", ErrShareInvalidSystemThemePackage
	}
	if strings.HasPrefix(strings.ToLower(target), "data:") {
		return target, nil
	}

	combined := target
	if baseDir != "" {
		combined = baseDir + "/" + target
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
				return "", ErrShareInvalidSystemThemePackage
			}
			resolved = resolved[:len(resolved)-1]
			continue
		}
		resolved = append(resolved, part)
	}
	if len(resolved) == 0 {
		return "", ErrShareInvalidSystemThemePackage
	}
	return strings.ToLower(strings.Join(resolved, "/")), nil
}

func validateShareThemeDescriptorAssets(baseDir string, descriptor shareThemePackageDescriptor, entryMap map[string]*zip.File) bool {
	if descriptor.Wallpaper != "" && !shareThemeAssetExists(baseDir, descriptor.Wallpaper, entryMap, true) {
		return false
	}
	if descriptor.CoverImage != "" && !shareThemeAssetExists(baseDir, descriptor.CoverImage, entryMap, true) {
		return false
	}
	for _, preview := range descriptor.PreviewImages {
		if !shareThemeAssetExists(baseDir, preview, entryMap, true) {
			return false
		}
	}
	for _, assetPath := range descriptor.IconPack {
		if !shareThemeAssetExists(baseDir, assetPath, entryMap, true) {
			return false
		}
	}
	if descriptor.CustomFont != nil && descriptor.CustomFont.File != "" && !shareThemeAssetExists(baseDir, descriptor.CustomFont.File, entryMap, false) {
		return false
	}
	return true
}

func shareThemeAssetExists(baseDir, assetPath string, entryMap map[string]*zip.File, imageOnly bool) bool {
	resolvedPath, err := resolveShareThemeAssetPath(baseDir, assetPath)
	if err != nil {
		return false
	}
	if strings.HasPrefix(resolvedPath, "data:") {
		return true
	}
	if _, exists := entryMap[resolvedPath]; !exists {
		return false
	}
	ext := strings.ToLower(filepath.Ext(resolvedPath))
	if imageOnly {
		_, ok := shareSystemThemeImageExts[ext]
		return ok
	}
	if _, ok := shareSystemThemeImageExts[ext]; ok {
		return true
	}
	_, ok := shareSystemThemeFontExts[ext]
	return ok
}

func mergeShareThemeDescriptors(base shareThemePackageDescriptor, override shareThemePackageDescriptor) shareThemePackageDescriptor {
	merged := base
	if override.ID != "" {
		merged.ID = override.ID
	}
	if override.Name != "" {
		merged.Name = override.Name
	}
	if override.Author != "" {
		merged.Author = override.Author
	}
	if override.Version != "" {
		merged.Version = override.Version
	}
	if override.Description != "" {
		merged.Description = override.Description
	}
	if len(override.Tags) > 0 {
		merged.Tags = override.Tags
	}
	if override.CoverImage != "" {
		merged.CoverImage = override.CoverImage
	}
	if len(override.PreviewImages) > 0 {
		merged.PreviewImages = override.PreviewImages
	}
	if override.Wallpaper != "" {
		merged.Wallpaper = override.Wallpaper
	}
	if len(override.IconPack) > 0 {
		nextIconPack := make(map[string]string, len(base.IconPack)+len(override.IconPack))
		for appID, assetPath := range base.IconPack {
			nextIconPack[appID] = assetPath
		}
		for appID, assetPath := range override.IconPack {
			nextIconPack[appID] = assetPath
		}
		merged.IconPack = nextIconPack
	}
	if override.CustomFont != nil && override.CustomFont.File != "" {
		merged.CustomFont = override.CustomFont
	}
	if override.Tokens != "" {
		merged.Tokens = override.Tokens
	}
	return merged
}

func (descriptor shareThemePackageDescriptor) toManifest() shareThemePackageManifest {
	return shareThemePackageManifest{
		ID:          descriptor.ID,
		Name:        descriptor.Name,
		Author:      descriptor.Author,
		Version:     descriptor.Version,
		Description: descriptor.Description,
		Tags:        descriptor.Tags,
	}
}

func normalizeShareThemeTags(tags []string) []string {
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

func normalizeShareThemeZipPath(path string) string {
	return strings.ToLower(strings.TrimSpace(strings.ReplaceAll(path, "\\", "/")))
}

func findShareCardAssetBySlot(assets []model.SharePlatformCardAsset, slot string) *model.SharePlatformCardAsset {
	normalizedSlot := normalizeShareCardSlot(slot)
	for _, asset := range assets {
		if normalizeShareCardSlot(asset.Slot) != normalizedSlot {
			continue
		}
		copy := asset
		return &copy
	}
	return nil
}

func buildShareCardAssetView(cardID string, asset model.SharePlatformCardAsset) ShareCardAssetView {
	slot := strings.TrimSpace(asset.Slot)
	return ShareCardAssetView{
		Slot:             slot,
		OriginalFileName: asset.OriginalFileName,
		MimeType:         asset.MimeType,
		Size:             asset.Size,
		PreviewUrl:       "/api/share/cards/" + cardID + "/assets/" + slot + "/preview",
		DownloadUrl:      "/api/share/cards/" + cardID + "/assets/" + slot + "/download",
	}
}

func validateAndCloneShareSystemThemeReader(fileName string, reader io.Reader) (io.Reader, error) {
	if strings.TrimSpace(fileName) == "" || reader == nil {
		return nil, ErrShareFileRequired
	}

	data, err := io.ReadAll(io.LimitReader(reader, shareSystemThemeMaxReadBytes+1))
	if err != nil {
		return nil, ErrShareInvalidSystemThemePackage
	}
	if len(data) == 0 {
		return nil, ErrShareFileRequired
	}
	if len(data) > shareSystemThemeMaxReadBytes {
		return nil, ErrShareSystemThemePackageTooLarge
	}
	if _, err := inspectShareThemePackage(fileName, data); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (s *ShareService) loadCardSystemThemeView(ctx context.Context, card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) (*ShareSystemThemeView, error) {
	asset := findShareCardAssetBySlot(assets, "system_theme")
	if asset == nil {
		return nil, nil
	}

	view, err := s.buildSystemThemeView(ctx, card, asset)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func isShareSystemThemeCard(ctx context.Context, db *gorm.DB, cardID string) (bool, error) {
	var count int64
	if err := db.WithContext(ctx).
		Model(&model.SharePlatformCardAsset{}).
		Where("card_id = ? AND slot = ?", strings.TrimSpace(cardID), "system_theme").
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
