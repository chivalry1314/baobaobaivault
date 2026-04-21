package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	AKPrefix           = "AK"
	TimestampHeaderKey = "X-BVault-Timestamp"
)

func GenerateAKSK() (string, string, error) {
	ak, err := randomString(18)
	if err != nil {
		return "", "", err
	}
	sk, err := randomString(42)
	if err != nil {
		return "", "", err
	}
	return AKPrefix + ak, sk, nil
}

func ParseAKSKAuthorization(header string) (accessKey, signature string, err error) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", "", errors.New("empty authorization header")
	}

	if strings.HasPrefix(strings.ToUpper(header), AKPrefix+" ") {
		header = strings.TrimSpace(header[len(AKPrefix):])
	}

	parts := strings.SplitN(header, ":", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", errors.New("invalid AK/SK authorization format")
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
}

func BuildCanonicalString(method, requestPath, rawQuery, timestamp, bodySHA256 string) string {
	method = strings.ToUpper(strings.TrimSpace(method))
	requestPath = strings.TrimSpace(requestPath)
	if requestPath == "" {
		requestPath = "/"
	}

	items := []string{method, requestPath, strings.TrimSpace(rawQuery), strings.TrimSpace(timestamp), strings.TrimSpace(bodySHA256)}
	return strings.Join(items, "\n")
}

func SignAKSK(secretKey, canonical string) string {
	h := hmac.New(sha256.New, []byte(secretKey))
	_, _ = io.WriteString(h, canonical)
	return hex.EncodeToString(h.Sum(nil))
}

func VerifyAKSKSignature(secretKey, canonical, signature string) bool {
	expected := SignAKSK(secretKey, canonical)
	return hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(strings.TrimSpace(signature))))
}

func Sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func TimestampWithinWindow(value string, window time.Duration) bool {
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(value))
	if err != nil {
		return false
	}
	now := time.Now()
	if t.After(now.Add(window)) {
		return false
	}
	return now.Sub(t) <= window
}

func randomString(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to read random bytes: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
