package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"testing"
)

func TestDetectShareWechatThemeFormat(t *testing.T) {
	tests := []struct {
		fileName string
		mimeType string
		expected string
	}{
		{"theme.json", "", "json"},
		{"theme.zip", "", "zip"},
		{"theme.txt", "application/json", "json"},
		{"theme.txt", "application/zip", "zip"},
		{"theme.txt", "", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.fileName, func(t *testing.T) {
			got := detectShareWechatThemeFormat(tt.fileName, tt.mimeType)
			if got != tt.expected {
				t.Errorf("detectShareWechatThemeFormat(%q, %q) = %q, want %q", tt.fileName, tt.mimeType, got, tt.expected)
			}
		})
	}
}

func TestDecodeShareWechatThemePackageDescriptor(t *testing.T) {
	data := []byte(`{
		"name": "蓝色玻璃主题",
		"author": "tester",
		"version": "1.0.0",
		"description": "desc",
		"tags": ["玻璃"],
		"chatBackgroundImage": "bg.jpg",
		"chatBackgroundOpacity": 0.25,
		"selfBubblePreset": "glass",
		"peerBubblePreset": "rounded",
		"rendererSource": "module.exports = {}"
	}`)

	descriptor, err := decodeShareWechatThemePackageDescriptor(data)
	if err != nil {
		t.Fatalf("decodeShareWechatThemePackageDescriptor() error = %v", err)
	}

	if descriptor.Name != "蓝色玻璃主题" {
		t.Errorf("Name = %q, want %q", descriptor.Name, "蓝色玻璃主题")
	}
	if descriptor.Author != "tester" {
		t.Errorf("Author = %q, want %q", descriptor.Author, "tester")
	}
	if descriptor.ChatBackgroundOpacity != 0.25 {
		t.Errorf("ChatBackgroundOpacity = %v, want 0.25", descriptor.ChatBackgroundOpacity)
	}
	if descriptor.SelfBubblePreset != "glass" {
		t.Errorf("SelfBubblePreset = %q, want glass", descriptor.SelfBubblePreset)
	}
	if descriptor.PeerBubblePreset != "rounded" {
		t.Errorf("PeerBubblePreset = %q, want rounded", descriptor.PeerBubblePreset)
	}
}

func TestDecodeShareWechatThemePackageDescriptorDefaults(t *testing.T) {
	data := []byte(`{"name": "默认主题"}`)

	descriptor, err := decodeShareWechatThemePackageDescriptor(data)
	if err != nil {
		t.Fatalf("decodeShareWechatThemePackageDescriptor() error = %v", err)
	}

	if descriptor.SelfBubblePreset != "wechat" {
		t.Errorf("SelfBubblePreset = %q, want wechat", descriptor.SelfBubblePreset)
	}
	if descriptor.PeerBubblePreset != "wechat" {
		t.Errorf("PeerBubblePreset = %q, want wechat", descriptor.PeerBubblePreset)
	}
	if descriptor.ChatBackgroundOpacity != 0 {
		t.Errorf("ChatBackgroundOpacity = %v, want 0", descriptor.ChatBackgroundOpacity)
	}
}

func TestInspectShareWechatThemeJson(t *testing.T) {
	data := []byte(`{"name": "JSON主题"}`)

	descriptor, err := inspectShareWechatThemePackage("theme.json", data)
	if err != nil {
		t.Fatalf("inspectShareWechatThemePackage() error = %v", err)
	}
	if descriptor.Name != "JSON主题" {
		t.Errorf("Name = %q, want %q", descriptor.Name, "JSON主题")
	}
}

func TestInspectShareWechatThemeJsonWithoutName(t *testing.T) {
	data := []byte(`{"author": "tester"}`)

	descriptor, err := inspectShareWechatThemePackage("theme.json", data)
	if err != nil {
		t.Fatalf("inspectShareWechatThemePackage() error = %v", err)
	}
	if descriptor.Name != "" {
		t.Errorf("Name = %q, want empty", descriptor.Name)
	}
	if descriptor.Author != "tester" {
		t.Errorf("Author = %q, want %q", descriptor.Author, "tester")
	}
}

func TestInspectShareWechatThemeZip(t *testing.T) {
	buf := new(bytes.Buffer)
	writer := zip.NewWriter(buf)

	manifest := map[string]any{
		"name":                "ZIP主题",
		"chatBackgroundImage": "bg.jpg",
	}
	manifestBytes, _ := json.Marshal(manifest)
	file, _ := writer.Create("manifest.json")
	_, _ = file.Write(manifestBytes)

	bg, _ := writer.Create("bg.jpg")
	_, _ = bg.Write([]byte("fake-image-data"))

	_ = writer.Close()

	descriptor, err := inspectShareWechatThemePackage("theme.zip", buf.Bytes())
	if err != nil {
		t.Fatalf("inspectShareWechatThemePackage() error = %v", err)
	}
	if descriptor.Name != "ZIP主题" {
		t.Errorf("Name = %q, want %q", descriptor.Name, "ZIP主题")
	}
	if descriptor.ChatBackgroundImage != "bg.jpg" {
		t.Errorf("ChatBackgroundImage = %q, want bg.jpg", descriptor.ChatBackgroundImage)
	}
}

func TestInspectShareWechatThemeZipMissingAsset(t *testing.T) {
	buf := new(bytes.Buffer)
	writer := zip.NewWriter(buf)

	manifest := map[string]any{
		"name":                "ZIP主题",
		"chatBackgroundImage": "missing.jpg",
	}
	manifestBytes, _ := json.Marshal(manifest)
	file, _ := writer.Create("manifest.json")
	_, _ = file.Write(manifestBytes)

	_ = writer.Close()

	_, err := inspectShareWechatThemePackage("theme.zip", buf.Bytes())
	if err == nil {
		t.Fatal("inspectShareWechatThemePackage() expected error for missing asset")
	}
}

func TestIsValidWechatBubblePreset(t *testing.T) {
	valid := []string{"wechat", "rounded", "glass", "outline"}
	for _, preset := range valid {
		if !isValidWechatBubblePreset(preset) {
			t.Errorf("isValidWechatBubblePreset(%q) = false, want true", preset)
		}
	}
	if isValidWechatBubblePreset("invalid") {
		t.Error("isValidWechatBubblePreset(invalid) = true, want false")
	}
}
