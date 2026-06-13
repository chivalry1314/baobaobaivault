package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateSecureSecret(t *testing.T) {
	for _, length := range []int{16, 32, 64} {
		s, err := GenerateSecureSecret(length)
		if err != nil {
			t.Fatalf("GenerateSecureSecret(%d) error: %v", length, err)
		}
		if len(s) != length {
			t.Fatalf("expected length %d, got %d", length, len(s))
		}
		for _, r := range s {
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
				t.Fatalf("unexpected character %q in secret", r)
			}
		}
	}
}

func TestGenerateBase64Key(t *testing.T) {
	key, err := GenerateBase64Key(32)
	if err != nil {
		t.Fatalf("GenerateBase64Key error: %v", err)
	}
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		t.Fatalf("failed to decode base64 key: %v", err)
	}
	if len(decoded) != 32 {
		t.Fatalf("expected 32 decoded bytes, got %d", len(decoded))
	}
}

func TestBootstrapGenerateOnly(t *testing.T) {
	dir := t.TempDir()
	if err := runBootstrap([]string{
		"--generate-only",
		"--out", dir,
		"--admin-email", "admin@example.com",
		"--domain", "share.example.com",
	}); err != nil {
		t.Fatalf("runBootstrap failed: %v", err)
	}

	envPath := filepath.Join(dir, ".env")
	cfgPath := filepath.Join(dir, "backend", "config", "config.yaml")

	envBytes, err := os.ReadFile(envPath)
	if err != nil {
		t.Fatalf("read .env: %v", err)
	}
	env := string(envBytes)
	if !strings.Contains(env, "POSTGRES_PASSWORD=") {
		t.Fatal(".env missing POSTGRES_PASSWORD")
	}
	if !strings.Contains(env, "REDIS_PASSWORD=") {
		t.Fatal(".env missing REDIS_PASSWORD")
	}
	if strings.Contains(env, "change-this") {
		t.Fatal(".env still contains placeholder secrets")
	}

	cfgBytes, err := os.ReadFile(cfgPath)
	if err != nil {
		t.Fatalf("read config.yaml: %v", err)
	}
	cfg := string(cfgBytes)
	if !strings.Contains(cfg, "mode: release") {
		t.Fatal("config.yaml missing release mode")
	}
	if !strings.Contains(cfg, "admin_email: \"admin@example.com\"") {
		t.Fatal("config.yaml missing admin email")
	}
	if !strings.Contains(cfg, "https://share.example.com") {
		t.Fatal("config.yaml missing domain CORS origin")
	}

	lines := strings.Split(cfg, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "password: \"") &&
			(strings.Contains(trimmed, "change-this") || strings.HasSuffix(trimmed, "\"")) {
			prev := ""
			if i > 0 {
				prev = strings.TrimSpace(lines[i-1])
			}
			if prev == "database:" || prev == "redis:" {
				t.Fatalf("config.yaml contains placeholder database/redis password: %s", line)
			}
		}
		if strings.HasPrefix(trimmed, "secret: \"") && strings.Contains(trimmed, "change-this") {
			t.Fatalf("config.yaml contains placeholder jwt secret: %s", line)
		}
		if strings.HasPrefix(trimmed, "field_encryption_key: \"") && strings.Contains(trimmed, "change-this") {
			t.Fatalf("config.yaml contains placeholder field encryption key: %s", line)
		}
	}
}

func TestBootstrapRefusesOverwrite(t *testing.T) {
	dir := t.TempDir()
	if err := runBootstrap([]string{
		"--generate-only",
		"--out", dir,
		"--admin-email", "admin@example.com",
		"--domain", "share.example.com",
	}); err != nil {
		t.Fatalf("first run failed: %v", err)
	}

	if err := runBootstrap([]string{
		"--generate-only",
		"--out", dir,
		"--admin-email", "admin2@example.com",
		"--domain", "other.example.com",
	}); err == nil {
		t.Fatal("expected error when overwriting existing files")
	}
}
