package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baobaobao/baobaobaivault/internal/api"
	"github.com/baobaobao/baobaobaivault/internal/config"
	"github.com/baobaobao/baobaobaivault/pkg/database"
	"github.com/baobaobao/baobaobaivault/pkg/redis"
	"go.uber.org/zap"
)

// @title Baobaobao Vault API
// @version 1.0
// @description 云存储统一管理平台 API
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @securityDefinitions.apikey AKSKAuth
// @in header
// @name Authorization
// @description AccessKey:Signature format for API authentication

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 初始化日志
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// 初始化数据库
	db, err := database.NewPostgresDB(cfg.Database, logger)
	if err != nil {
		logger.Fatal("Failed to connect database", zap.Error(err))
	}
	defer database.Close(db)

	// 初始化 Redis
	rdb, err := redis.NewClient(cfg.Redis, logger)
	if err != nil {
		logger.Fatal("Failed to connect redis", zap.Error(err))
	}
	defer redis.Close(rdb)

	// 自动迁移数据库表
	if err := database.AutoMigrate(db); err != nil {
		logger.Fatal("Failed to migrate database", zap.Error(err))
	}

	// 初始化 API 路由
	router := api.NewRouter(cfg, db, rdb, logger)

	// 启动 HTTP 服务器
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	// 优雅关闭
	go func() {
		logger.Info("Server starting", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed", zap.Error(err))
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited properly")
}
