package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/api"
	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/pkg/crypto"
	"github.com/baobaobai/baobaobaivault/pkg/database"
	"github.com/baobaobai/baobaobaivault/pkg/redis"
	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// @title Baobaobai Vault API
// @version 1.0
// @description 包包白存储服务 API
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/share
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate":
			if err := runMigrate(); err != nil {
				fmt.Printf("migrate failed: %v\n", err)
				os.Exit(1)
			}
			return
		case "create-admin":
			if err := runCreateAdmin(os.Args[2:]); err != nil {
				fmt.Printf("create-admin failed: %v\n", err)
				os.Exit(1)
			}
			return
		case "bootstrap":
			if err := runBootstrap(os.Args[2:]); err != nil {
				fmt.Printf("bootstrap failed: %v\n", err)
				os.Exit(1)
			}
			return
		}
	}

	if err := runServer(); err != nil {
		fmt.Printf("server failed: %v\n", err)
		os.Exit(1)
	}
}

func initDeps() (*config.Config, *gorm.DB, *goredis.Client, *zap.Logger, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("load config: %w", err)
	}

	if err := crypto.SetFieldEncryptionKey(cfg.Security.FieldEncryptionKey); err != nil {
		return nil, nil, nil, nil, fmt.Errorf("configure field encryption: %w", err)
	}

	logger, err := zap.NewProduction()
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("init logger: %w", err)
	}

	db, err := database.NewPostgresDB(cfg.Server, cfg.Database, logger)
	if err != nil {
		logger.Sync()
		return nil, nil, nil, nil, fmt.Errorf("connect database: %w", err)
	}

	rdb, err := redis.NewClient(cfg.Redis, logger)
	if err != nil {
		database.Close(db)
		logger.Sync()
		return nil, nil, nil, nil, fmt.Errorf("connect redis: %w", err)
	}

	return cfg, db, rdb, logger, nil
}

func runMigrate() error {
	_, db, _, logger, err := initDeps()
	if err != nil {
		return err
	}
	defer database.Close(db)
	defer logger.Sync()

	if err := database.AutoMigrate(db); err != nil {
		return err
	}
	logger.Info("database migration completed")
	return nil
}

func runCreateAdmin(args []string) error {
	cfg, db, _, logger, err := initDeps()
	if err != nil {
		return err
	}
	defer database.Close(db)
	defer logger.Sync()

	if err := database.AutoMigrate(db); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}

	fs := flag.NewFlagSet("create-admin", flag.ExitOnError)
	email := fs.String("email", "", "admin email address")
	password := fs.String("password", "", "admin password")
	forcePasswordChange := fs.Bool("force-password-change", false, "require the user to change password on next login")
	if err := fs.Parse(args); err != nil {
		return err
	}

	adminEmail := strings.TrimSpace(*email)
	if adminEmail == "" {
		adminEmail = strings.TrimSpace(cfg.Server.AdminEmail)
	}
	if adminEmail == "" {
		return fmt.Errorf("admin email is required, provide --email or set server.admin_email in config")
	}
	if strings.TrimSpace(*password) == "" {
		return fmt.Errorf("admin password is required, provide --password")
	}
	if len(*password) < 6 {
		return fmt.Errorf("admin password must be at least 6 characters")
	}

	if err := createOrUpdateAdmin(db, adminEmail, *password, *forcePasswordChange, logger); err != nil {
		return err
	}

	fmt.Printf("Admin user ready: %s\n", adminEmail)
	return nil
}

func runServer() error {
	cfg, db, rdb, logger, err := initDeps()
	if err != nil {
		return err
	}
	defer database.Close(db)
	defer redis.Close(rdb)
	defer logger.Sync()

	if err := database.AutoMigrate(db); err != nil {
		logger.Fatal("Failed to migrate database", zap.Error(err))
	}

	router := api.NewRouter(cfg, db, rdb, logger)

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		logger.Info("Server starting", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed", zap.Error(err))
		}
	}()

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
	return nil
}
