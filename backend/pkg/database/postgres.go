package database

import (
	"fmt"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewPostgresDB creates and configures a PostgreSQL connection.
func NewPostgresDB(cfg config.DatabaseConfig, log *zap.Logger) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	gormConfig := &gorm.Config{
		Logger:      logger.Default.LogMode(logger.Info),
		PrepareStmt: true, // Work around pgx + gorm postgres migrator ColumnTypes issue ("insufficient arguments")
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	log.Info("Database connected",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("database", cfg.DBName),
	)

	return db, nil
}

// AutoMigrate runs all schema migrations.
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Tenant{},
		&model.Namespace{},
		&model.User{},
		&model.Role{},
		&model.Permission{},
		&model.RoleNamespace{},
		&model.StorageConfig{},
		&model.Object{},
		&model.ObjectVersion{},
		&model.AKSK{},
		&model.CloudAccount{},
		&model.AuditLog{},
		&model.WebPushSubscription{},
		&model.WebPushEvent{},
		&model.ShareExternalUser{},
		&model.SharePlatformCard{},
		&model.SharePlatformDownloadLog{},
	)
}

// Close closes database connection.
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
