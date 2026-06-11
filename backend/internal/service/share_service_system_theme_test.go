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
