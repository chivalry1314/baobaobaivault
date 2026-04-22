package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

// Claims carries authentication identity fields.
type Claims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// JWTManager handles JWT issue/validate.
type JWTManager struct {
	secret []byte
	issuer string
	ttl    time.Duration
}

func NewJWTManager(cfg config.JWTConfig) *JWTManager {
	ttl := cfg.ExpireTime
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &JWTManager{
		secret: []byte(cfg.Secret),
		issuer: cfg.Issuer,
		ttl:    ttl,
	}
}

func (m *JWTManager) GenerateToken(userID, tenantID, username string) (string, time.Time, error) {
	now := time.Now()
	expireAt := now.Add(m.ttl)

	claims := &Claims{
		UserID:   userID,
		TenantID: tenantID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expireAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return tokenString, expireAt, nil
}

func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	if m.issuer != "" && claims.Issuer != m.issuer {
		return nil, errors.New("invalid token issuer")
	}
	return claims, nil
}

func ExtractBearerToken(authHeader string) (string, error) {
	parts := strings.SplitN(strings.TrimSpace(authHeader), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
		return "", errors.New("invalid bearer token format")
	}
	return strings.TrimSpace(parts[1]), nil
}
