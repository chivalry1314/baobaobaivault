package api

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/gin-gonic/gin"
)

var defaultCORSAllowOrigins = []string{
	"http://localhost:3002",
	"http://127.0.0.1:3002",
}

func newCORSMiddleware(cfg config.CorsConfig, publicReadCfg config.CorsConfig) gin.HandlerFunc {
	defaultPolicy := buildCORSPolicy(
		cfg,
		defaultCORSAllowOrigins,
		[]string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		[]string{"Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"},
	)
	publicReadPolicy := buildCORSPolicy(
		publicReadCfg,
		nil,
		[]string{http.MethodGet, http.MethodHead, http.MethodOptions},
		[]string{"*"},
	)

	return func(c *gin.Context) {
		if isSharePublicReadCORSRequest(c.Request) && publicReadPolicy.enabled {
			if applyCORSPolicy(c, publicReadPolicy) {
				return
			}
			c.Next()
			return
		}

		if applyCORSPolicy(c, defaultPolicy) {
			return
		}
		c.Next()
	}
}

type corsPolicy struct {
	enabled          bool
	allowOrigins     []string
	allowMethods     []string
	allowHeaders     []string
	exposeHeaders    []string
	allowAllOrigins  bool
	allowAllHeaders  bool
	allowCredentials bool
	maxAge           int
}

func buildCORSPolicy(
	cfg config.CorsConfig,
	defaultOrigins []string,
	defaultMethods []string,
	defaultHeaders []string,
) corsPolicy {
	allowOrigins := normalizeCORSValues(cfg.AllowOrigins, defaultOrigins, false)
	allowMethods := normalizeCORSValues(cfg.AllowMethods, defaultMethods, true)
	allowHeaders := normalizeCORSValues(cfg.AllowHeaders, defaultHeaders, false)
	exposeHeaders := normalizeCORSValues(cfg.ExposeHeaders, nil, false)
	allowAllOrigins := containsCORSValue(allowOrigins, "*")
	allowAllHeaders := containsCORSValue(allowHeaders, "*")
	allowCredentials := cfg.AllowCredentials && !allowAllOrigins

	return corsPolicy{
		enabled:          cfg.Enabled,
		allowOrigins:     allowOrigins,
		allowMethods:     allowMethods,
		allowHeaders:     allowHeaders,
		exposeHeaders:    exposeHeaders,
		allowAllOrigins:  allowAllOrigins,
		allowAllHeaders:  allowAllHeaders,
		allowCredentials: allowCredentials,
		maxAge:           cfg.MaxAge,
	}
}

func applyCORSPolicy(c *gin.Context, policy corsPolicy) bool {
	if !policy.enabled {
		return false
	}

	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if origin == "" {
		return false
	}

	allowedOrigin := ""
	if policy.allowAllOrigins {
		if policy.allowCredentials {
			allowedOrigin = origin
		} else {
			allowedOrigin = "*"
		}
	} else if isOriginAllowed(origin, policy.allowOrigins) {
		allowedOrigin = origin
	}

	if allowedOrigin == "" {
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusForbidden)
			return true
		}
		return false
	}

	c.Header("Access-Control-Allow-Origin", allowedOrigin)
	appendVaryHeader(c, "Origin")

	if policy.allowCredentials {
		c.Header("Access-Control-Allow-Credentials", "true")
	}
	if len(policy.exposeHeaders) > 0 {
		c.Header("Access-Control-Expose-Headers", strings.Join(policy.exposeHeaders, ", "))
	}

	if c.Request.Method == http.MethodOptions {
		c.Header("Access-Control-Allow-Methods", strings.Join(policy.allowMethods, ", "))
		if policy.allowAllHeaders {
			requestHeaders := strings.TrimSpace(c.GetHeader("Access-Control-Request-Headers"))
			if requestHeaders != "" {
				c.Header("Access-Control-Allow-Headers", requestHeaders)
			} else {
				c.Header("Access-Control-Allow-Headers", "*")
			}
			appendVaryHeader(c, "Access-Control-Request-Headers")
		} else if len(policy.allowHeaders) > 0 {
			c.Header("Access-Control-Allow-Headers", strings.Join(policy.allowHeaders, ", "))
		}
		if policy.maxAge > 0 {
			c.Header("Access-Control-Max-Age", strconv.Itoa(policy.maxAge))
		}

		c.AbortWithStatus(http.StatusNoContent)
		return true
	}

	return false
}

func normalizeCORSValues(values []string, defaults []string, upper bool) []string {
	working := values
	if len(working) == 0 {
		working = defaults
	}
	if len(working) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(working))
	normalized := make([]string, 0, len(working))
	for _, raw := range working {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if upper {
			value = strings.ToUpper(value)
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}

	return normalized
}

func containsCORSValue(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func isOriginAllowed(origin string, allowOrigins []string) bool {
	origin = strings.TrimSpace(strings.TrimSuffix(origin, "/"))
	for _, candidate := range allowOrigins {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if candidate == "*" {
			return true
		}
		if strings.HasSuffix(candidate, "*") {
			prefix := strings.TrimSuffix(candidate, "*")
			if strings.HasPrefix(origin, prefix) {
				return true
			}
			continue
		}
		if strings.TrimSuffix(candidate, "/") == origin {
			return true
		}
	}
	return false
}

func appendVaryHeader(c *gin.Context, token string) {
	token = strings.TrimSpace(token)
	if token == "" {
		return
	}

	current := strings.TrimSpace(c.Writer.Header().Get("Vary"))
	if current == "" {
		c.Header("Vary", token)
		return
	}

	for _, item := range strings.Split(current, ",") {
		if strings.EqualFold(strings.TrimSpace(item), token) {
			return
		}
	}
	c.Header("Vary", current+", "+token)
}

func isSharePublicReadCORSRequest(r *http.Request) bool {
	if r == nil {
		return false
	}

	method := strings.ToUpper(strings.TrimSpace(r.Method))
	switch method {
	case http.MethodGet, http.MethodHead:
		return isSharePublicReadPath(r.URL)
	case http.MethodOptions:
		return isSharePublicReadOptionsRequest(r)
	default:
		return false
	}
}

func isSharePublicReadOptionsRequest(r *http.Request) bool {
	targetPath := ""
	if value := strings.TrimSpace(r.Header.Get("Access-Control-Request-Path")); value != "" {
		targetPath = value
	}

	if targetPath == "" {
		if value := strings.TrimSpace(r.Header.Get("Referer")); value != "" {
			if parsed, err := url.Parse(value); err == nil {
				targetPath = parsed.Path
			}
		}
	}

	if targetPath == "" && r.URL != nil {
		targetPath = r.URL.Path
	}

	if !isSharePublicReadPathString(targetPath) {
		return false
	}

	requestMethod := strings.ToUpper(strings.TrimSpace(r.Header.Get("Access-Control-Request-Method")))
	return requestMethod == "" || requestMethod == http.MethodGet || requestMethod == http.MethodHead
}

func isSharePublicReadPath(u *url.URL) bool {
	if u == nil {
		return false
	}
	return isSharePublicReadPathString(u.Path)
}

func isSharePublicReadPathString(path string) bool {
	path = strings.TrimSpace(path)
	switch path {
	case "/api/share/discover/cards", "/api/share/discover/system-themes", "/api/share/discover/wechat-themes", "/api/share/discover/desktop-components", "/api/share/discover/site-branding", "/api/share/discover/site-branding/logo":
		return true
	}

	if strings.HasPrefix(path, "/api/share/cards/") {
		return true
	}
	if strings.HasPrefix(path, "/api/share/users/") && strings.Contains(path, "/assets/") {
		return true
	}
	return false
}
