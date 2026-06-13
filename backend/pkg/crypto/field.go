package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

var (
	fieldMasterKey []byte
	// ErrNotEncrypted indicates the value does not look like an encrypted field.
	ErrNotEncrypted = errors.New("value is not encrypted")
)

// SetFieldEncryptionKey configures the 32-byte AES key used for field-level encryption.
// It can be called multiple times but only the first non-empty key takes effect.
func SetFieldEncryptionKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil
	}
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		// Accept raw 32-byte string as fallback for local dev.
		decoded = []byte(key)
	}
	if len(decoded) != 16 && len(decoded) != 24 && len(decoded) != 32 {
		return fmt.Errorf("field encryption key must be 16/24/32 bytes, got %d bytes", len(decoded))
	}
	if fieldMasterKey == nil {
		fieldMasterKey = decoded
	}
	return nil
}

// FieldEncryptionEnabled reports whether field-level encryption is configured.
func FieldEncryptionEnabled() bool {
	return len(fieldMasterKey) > 0
}

// EncryptField encrypts a plaintext string and returns a base64-encoded ciphertext.
// The format is "enc:<base64(nonce||ciphertext)>" so decrypt can detect encrypted values.
func EncryptField(plaintext string) (string, error) {
	if !FieldEncryptionEnabled() {
		return plaintext, nil
	}
	if plaintext == "" {
		return "", nil
	}
	block, err := aes.NewCipher(fieldMasterKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "enc:" + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptField decrypts a value produced by EncryptField.
// If the value does not have the "enc:" prefix, it is returned as-is (legacy plaintext fallback).
func DecryptField(value string) (string, error) {
	if !FieldEncryptionEnabled() || value == "" {
		return value, nil
	}
	if !strings.HasPrefix(value, "enc:") {
		return value, nil
	}
	encoded := strings.TrimPrefix(value, "enc:")
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("failed to decode encrypted field: %w", err)
	}
	block, err := aes.NewCipher(fieldMasterKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	plaintext, err := gcm.Open(nil, data[:nonceSize], data[nonceSize:], nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt field: %w", err)
	}
	return string(plaintext), nil
}

// ReencryptField is a helper to migrate existing plaintext values.
func ReencryptField(value string) (string, error) {
	if !FieldEncryptionEnabled() {
		return value, nil
	}
	if value == "" || strings.HasPrefix(value, "enc:") {
		return value, nil
	}
	return EncryptField(value)
}

// SecureCompare performs a constant-time comparison of two strings.
func SecureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
