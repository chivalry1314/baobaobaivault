package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestInspectShareThemePackage_AllowsLargeManifestWithDesktopLayout(t *testing.T) {
	t.Helper()

	manifest := map[string]any{
		"id":          "current-system-theme-snapshot",
		"name":        "Current System Theme",
		"author":      "User",
		"version":     "1.0.0",
		"description": "Exported from baobaobaiphone",
		"wallpaper":   "wallpaper.png",
		"iconPack": map[string]string{
			"settings": "icons/settings.png",
		},
		"tokens": "tokens.json",
		"desktopLayout": map[string]any{
			"rows":      6,
			"cols":      4,
			"pageCount": 2,
			"items": []map[string]any{
				{
					"componentId": "custom-widget",
					"type":        "widget",
					"page":        0,
					"x":           0,
					"y":           0,
					"w":           2,
					"h":           2,
					"data": map[string]any{
						"name":            "ins照片",
						"templateId":      "ins-photo",
						"backgroundImage": "data:image/png;base64," + strings.Repeat("A", 5*1024*1024),
					},
				},
			},
			"customWidgets": []map[string]any{
				{
					"id":         "custom-widget-1",
					"name":       "ins照片",
					"width":      2,
					"height":     2,
					"templateId": "custom-code",
					"widgetCode": "export default function Widget(){return null;}",
				},
			},
		},
	}

	manifestBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	if len(manifestBytes) <= 512*1024 {
		t.Fatalf("manifest should exceed previous 512KB limit, got %d bytes", len(manifestBytes))
	}

	tokensBytes := []byte(`{"themeTokens":{"systemBg":"#eff6ff"}}`)
	zipBytes, err := buildThemeZipForTest(map[string][]byte{
		"manifest.json":      manifestBytes,
		"tokens.json":        tokensBytes,
		"wallpaper.png":      []byte("png"),
		"icons/settings.png": []byte("png"),
	})
	if err != nil {
		t.Fatalf("build zip: %v", err)
	}

	result, err := inspectShareThemePackage("theme.zip", zipBytes)
	if err != nil {
		t.Fatalf("inspect theme package: %v", err)
	}
	if result.Name != "Current System Theme" {
		t.Fatalf("unexpected manifest name: %q", result.Name)
	}
}

func TestMergeShareSystemThemeManifest_PrefersCardConfiguredContent(t *testing.T) {
	base := ShareSystemThemeView{
		Protocol:    shareSystemThemeProtocol,
		ID:          "card-id",
		Name:        "Card Title",
		Description: "Card Description",
		Tags:        []string{"exported", "current-system"},
		FileName:    "theme.zip",
	}
	manifest := shareThemePackageManifest{
		ID:          "theme-id",
		Name:        "Package Title",
		Author:      "Package Author",
		Version:     "2.0.0",
		Description: "Package Description",
		Tags:        []string{"retro", "warm"},
	}

	merged := mergeShareSystemThemeManifest(base, manifest)
	if merged.ID != "theme-id" {
		t.Fatalf("expected manifest id to be applied, got %q", merged.ID)
	}
	if merged.Name != "Card Title" {
		t.Fatalf("expected card title to win, got %q", merged.Name)
	}
	if merged.Description != "Card Description" {
		t.Fatalf("expected card description to win, got %q", merged.Description)
	}
	if merged.Author != "Package Author" {
		t.Fatalf("expected manifest author to be applied, got %q", merged.Author)
	}
	if merged.Version != "2.0.0" {
		t.Fatalf("expected manifest version to be applied, got %q", merged.Version)
	}
	if len(merged.Tags) != 2 || merged.Tags[0] != "exported" || merged.Tags[1] != "current-system" {
		t.Fatalf("expected card tags to win, got %#v", merged.Tags)
	}
	if !merged.Supported {
		t.Fatal("expected supported to be true when manifest name exists")
	}
}

func TestMergeShareSystemThemeManifest_UsesManifestAsFallback(t *testing.T) {
	base := ShareSystemThemeView{
		Protocol: shareSystemThemeProtocol,
		ID:       "card-id",
		Tags:     []string{},
		FileName: "theme.zip",
	}
	manifest := shareThemePackageManifest{
		ID:          "theme-id",
		Name:        "Package Title",
		Description: "Package Description",
		Tags:        []string{"retro", "warm"},
	}

	merged := mergeShareSystemThemeManifest(base, manifest)
	if merged.Name != "Package Title" {
		t.Fatalf("expected manifest title fallback, got %q", merged.Name)
	}
	if merged.Description != "Package Description" {
		t.Fatalf("expected manifest description fallback, got %q", merged.Description)
	}
	if len(merged.Tags) != 2 || merged.Tags[0] != "retro" || merged.Tags[1] != "warm" {
		t.Fatalf("expected manifest tags fallback, got %#v", merged.Tags)
	}
}

func TestEncodeDecodeShareCardTags(t *testing.T) {
	encoded := encodeShareCardTags([]string{" exported ", "current-system", "Exported", "", "桌面  主题"})
	if encoded == "" {
		t.Fatal("expected encoded tags")
	}
	decoded := decodeShareCardTags(encoded)
	if len(decoded) != 3 {
		t.Fatalf("expected 3 tags after normalization, got %#v", decoded)
	}
	if decoded[0] != "exported" || decoded[1] != "current-system" || decoded[2] != "桌面 主题" {
		t.Fatalf("unexpected decoded tags: %#v", decoded)
	}
}

func buildThemeZipForTest(files map[string][]byte) ([]byte, error) {
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, data := range files {
		entry, err := writer.Create(name)
		if err != nil {
			_ = writer.Close()
			return nil, err
		}
		if _, err := entry.Write(data); err != nil {
			_ = writer.Close()
			return nil, err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}
