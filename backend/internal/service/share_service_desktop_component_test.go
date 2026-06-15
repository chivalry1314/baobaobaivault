package service

import (
	"testing"
)

func TestInspectShareDesktopComponent(t *testing.T) {
	tests := []struct {
		name     string
		html     string
		wantErr  bool
		expected shareDesktopComponentMetadata
	}{
		{
			name: "valid html with meta tags",
			html: `<!DOCTYPE html>
<html>
<head>
  <meta name="widget-name" content="天气卡片">
  <meta name="widget-width" content="3">
  <meta name="widget-height" content="2">
  <meta name="widget-corner-radius" content="24">
  <meta name="widget-frosted" content="10">
  <meta name="widget-shadow" content="14">
  <meta name="widget-background-opacity" content="20">
</head>
<body>
  <div>Hello</div>
</body>
</html>`,
			wantErr: false,
			expected: shareDesktopComponentMetadata{
				Name:              "天气卡片",
				Width:             3,
				Height:            2,
				CornerRadius:      24,
				Frosted:           10,
				Shadow:            14,
				BackgroundOpacity: 20,
			},
		},
		{
			name: "valid html with defaults",
			html: `<!DOCTYPE html>
<html>
<head></head>
<body><div>Simple widget</div></body>
</html>`,
			wantErr: false,
			expected: shareDesktopComponentMetadata{
				Width:             2,
				Height:            2,
				CornerRadius:      22,
				Frosted:           8,
				Shadow:            12,
				BackgroundOpacity: 0,
			},
		},
		{
			name:     "invalid without html or body",
			html:     `<div>Not a full html</div>`,
			wantErr:  true,
			expected: shareDesktopComponentMetadata{},
		},
		{
			name: "clamp out of range values",
			html: `<!DOCTYPE html>
<html>
<head>
  <meta name="widget-width" content="10">
  <meta name="widget-height" content="0">
  <meta name="widget-background-opacity" content="150">
</head>
<body></body>
</html>`,
			wantErr: false,
			expected: shareDesktopComponentMetadata{
				Width:             4,
				Height:            1,
				CornerRadius:      22,
				Frosted:           8,
				Shadow:            12,
				BackgroundOpacity: 100,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := inspectShareDesktopComponent([]byte(tt.html))
			if (err != nil) != tt.wantErr {
				t.Errorf("inspectShareDesktopComponent() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if got.Name != tt.expected.Name {
				t.Errorf("Name = %q, want %q", got.Name, tt.expected.Name)
			}
			if got.Width != tt.expected.Width {
				t.Errorf("Width = %d, want %d", got.Width, tt.expected.Width)
			}
			if got.Height != tt.expected.Height {
				t.Errorf("Height = %d, want %d", got.Height, tt.expected.Height)
			}
			if got.CornerRadius != tt.expected.CornerRadius {
				t.Errorf("CornerRadius = %d, want %d", got.CornerRadius, tt.expected.CornerRadius)
			}
			if got.Frosted != tt.expected.Frosted {
				t.Errorf("Frosted = %d, want %d", got.Frosted, tt.expected.Frosted)
			}
			if got.Shadow != tt.expected.Shadow {
				t.Errorf("Shadow = %d, want %d", got.Shadow, tt.expected.Shadow)
			}
			if got.BackgroundOpacity != tt.expected.BackgroundOpacity {
				t.Errorf("BackgroundOpacity = %d, want %d", got.BackgroundOpacity, tt.expected.BackgroundOpacity)
			}
		})
	}
}

func TestDetectShareDesktopComponentFormat(t *testing.T) {
	tests := []struct {
		fileName string
		mimeType string
		expected string
	}{
		{"widget.html", "", "html"},
		{"widget.htm", "", "html"},
		{"widget.txt", "text/html", "html"},
		{"widget.txt", "application/html", "html"},
		{"widget.zip", "", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.fileName, func(t *testing.T) {
			got := detectShareDesktopComponentFormat(tt.fileName, tt.mimeType)
			if got != tt.expected {
				t.Errorf("detectShareDesktopComponentFormat(%q, %q) = %q, want %q", tt.fileName, tt.mimeType, got, tt.expected)
			}
		})
	}
}
