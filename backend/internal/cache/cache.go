package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

var ErrNotFound = errors.New("cache key not found")

// Client is a thin JSON cache wrapper on top of Redis.
type Client struct {
	rdb        *redis.Client
	defaultTTL time.Duration
	logger     *zap.Logger
	enabled    bool
}

// New creates a cache client. Passing a nil redis client disables caching gracefully.
func New(rdb *redis.Client, defaultTTL time.Duration, logger *zap.Logger) *Client {
	return &Client{
		rdb:        rdb,
		defaultTTL: defaultTTL,
		logger:     logger,
		enabled:    rdb != nil,
	}
}

// Enabled reports whether Redis caching is available.
func (c *Client) Enabled() bool {
	return c.enabled
}

// Get retrieves and unmarshals a cached value. Returns false when the key is missing or unreadable.
func (c *Client) Get(ctx context.Context, key string, dest any) bool {
	if c == nil || !c.enabled {
		return false
	}
	data, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false
		}
		c.logger.Warn("cache get failed", zap.String("key", key), zap.Error(err))
		return false
	}
	if err := json.Unmarshal(data, dest); err != nil {
		c.logger.Warn("cache unmarshal failed", zap.String("key", key), zap.Error(err))
		return false
	}
	return true
}

// Set marshals and stores a value with the given TTL. A zero or negative TTL falls back to the default TTL.
func (c *Client) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	if c == nil || !c.enabled {
		return nil
	}
	if ttl <= 0 {
		ttl = c.defaultTTL
	}
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache marshal failed: %w", err)
	}
	if err := c.rdb.Set(ctx, key, data, ttl).Err(); err != nil {
		c.logger.Warn("cache set failed", zap.String("key", key), zap.Error(err))
		return err
	}
	return nil
}

// Delete removes one or more keys from the cache.
func (c *Client) Delete(ctx context.Context, keys ...string) error {
	if c == nil || !c.enabled || len(keys) == 0 {
		return nil
	}
	if err := c.rdb.Del(ctx, keys...).Err(); err != nil {
		c.logger.Warn("cache delete failed", zap.Strings("keys", keys), zap.Error(err))
		return err
	}
	return nil
}

// DeletePattern removes all keys matching a glob pattern using SCAN.
func (c *Client) DeletePattern(ctx context.Context, pattern string) error {
	if c == nil || !c.enabled {
		return nil
	}
	var cursor uint64
	for {
		keys, next, err := c.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			c.logger.Warn("cache scan failed", zap.String("pattern", pattern), zap.Error(err))
			return err
		}
		if len(keys) > 0 {
			if err := c.rdb.Del(ctx, keys...).Err(); err != nil {
				c.logger.Warn("cache delete scanned failed", zap.Strings("keys", keys), zap.Error(err))
				return err
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return nil
}

// Key builds a colon-separated cache key from parts.
func Key(parts ...string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ":"
		}
		out += p
	}
	return out
}
