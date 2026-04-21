package redis

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// Client wraps common Redis operations used by services and middleware.
type Client struct {
	raw *goredis.Client
}

func New(client *goredis.Client) *Client {
	return &Client{raw: client}
}

func (c *Client) Raw() *goredis.Client {
	return c.raw
}

func (c *Client) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if c.raw == nil {
		return errors.New("redis client is nil")
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.raw.Set(ctx, key, data, ttl).Err()
}

func (c *Client) GetJSON(ctx context.Context, key string, dest any) error {
	if c.raw == nil {
		return errors.New("redis client is nil")
	}
	val, err := c.raw.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// IncrWithExpire increments a key and ensures expiration is set.
func (c *Client) IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	if c.raw == nil {
		return 0, errors.New("redis client is nil")
	}
	pipe := c.raw.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incr.Val(), nil
}
