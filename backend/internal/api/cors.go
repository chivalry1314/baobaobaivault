package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/gin-gonic/gin"
)

var defaultCORSAllowOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:4173",
	"http://127.0.0.1:4173",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
}

func newCORSMiddleware(cfg config.CorsConfig) gin.HandlerFunc {
	allowOrigins := normalizeCORSValues(cfg.AllowOrigins, defaultCORSAllowOrigins, false)
	allowMethods := normalizeCORSValues(
		cfg.AllowMethods,
		[]string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		true,
	)
	allowHeaders := normalizeCORSValues(
		cfg.AllowHeaders,
		[]string{"Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"},
		false,
	)
	exposeHeaders := normalizeCORSValues(cfg.ExposeHeaders, nil, false)

	allowAllOrigins := containsCORSValue(allowOrigins, "*")
	allowAllHeaders := containsCORSValue(allowHeaders, "*")
	allowCredentials := cfg.AllowCredentials && !allowAllOrigins

	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		if origin == "" {
			c.Next()
			return
		}

		allowedOrigin := ""
		if allowAllOrigins {
			if allowCredentials {
				allowedOrigin = origin
			} else {
				allowedOrigin = "*"
			}
		} else if isOriginAllowed(origin, allowOrigins) {
			allowedOrigin = origin
		}

		if allowedOrigin == "" {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}

		c.Header("Access-Control-Allow-Origin", allowedOrigin)
		appendVaryHeader(c, "Origin")

		if allowCredentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		if len(exposeHeaders) > 0 {
			c.Header("Access-Control-Expose-Headers", strings.Join(exposeHeaders, ", "))
		}

		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Methods", strings.Join(allowMethods, ", "))
			if allowAllHeaders {
				requestHeaders := strings.TrimSpace(c.GetHeader("Access-Control-Request-Headers"))
				if requestHeaders != "" {
					c.Header("Access-Control-Allow-Headers", requestHeaders)
				} else {
					c.Header("Access-Control-Allow-Headers", "*")
				}
				appendVaryHeader(c, "Access-Control-Request-Headers")
			} else if len(allowHeaders) > 0 {
				c.Header("Access-Control-Allow-Headers", strings.Join(allowHeaders, ", "))
			}
			if cfg.MaxAge > 0 {
				c.Header("Access-Control-Max-Age", strconv.Itoa(cfg.MaxAge))
			}

			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
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
