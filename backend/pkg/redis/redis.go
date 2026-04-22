package redis

import (
	"context"
	"fmt"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// NewClient 创建 Redis 客户端
func NewClient(cfg config.RedisConfig, log *zap.Logger) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 测试连接
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect redis: %w", err)
	}

	log.Info("Redis connected",
		zap.String("addr", fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)),
		zap.Int("db", cfg.DB),
	)

	return client, nil
}

// Close 关闭 Redis 连接
func Close(client *redis.Client) error {
	return client.Close()
}
