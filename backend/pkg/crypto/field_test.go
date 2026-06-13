package crypto

import (
	"strings"
	"testing"
)

func TestFieldEncryptionRoundTrip(t *testing.T) {
	fieldMasterKey = nil
	if err := SetFieldEncryptionKey("0123456789abcdef0123456789abcdef"); err != nil {
		t.Fatalf("set key failed: %v", err)
	}
	plaintext := "my-super-secret-key"
	encrypted, err := EncryptField(plaintext)
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if encrypted == plaintext {
		t.Fatalf("expected ciphertext, got plaintext")
	}
	if !strings.HasPrefix(encrypted, "enc:") {
		t.Fatalf("expected enc: prefix, got %s", encrypted)
	}
	decrypted, err := DecryptField(encrypted)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if decrypted != plaintext {
		t.Fatalf("round trip mismatch: want %q got %q", plaintext, decrypted)
	}
}

func TestFieldEncryptionDisabled(t *testing.T) {
	fieldMasterKey = nil
	plaintext := "secret"
	encrypted, err := EncryptField(plaintext)
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if encrypted != plaintext {
		t.Fatalf("expected plaintext passthrough when disabled, got %q", encrypted)
	}
}

func TestInvalidKeyLength(t *testing.T) {
	if err := SetFieldEncryptionKey("too-short"); err == nil {
		t.Fatalf("expected error for short key")
	}
}
