package database

import (
	"fmt"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// NewPostgresDB creates and configures a PostgreSQL connection.
func NewPostgresDB(serverCfg config.ServerConfig, cfg config.DatabaseConfig, log *zap.Logger) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	logLevel := gormlogger.Warn
	switch strings.ToLower(strings.TrimSpace(serverCfg.Mode)) {
	case "debug":
		logLevel = gormlogger.Info
	case "test":
		logLevel = gormlogger.Error
	}

	gormConfig := &gorm.Config{
		Logger:      gormlogger.Default.LogMode(logLevel),
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
	if err := db.AutoMigrate(
		&model.Namespace{},
		&model.User{},
		&model.Role{},
		&model.Permission{},
		&model.RoleNamespace{},
		&model.StorageConfig{},
		&model.Object{},
		&model.ObjectVersion{},
		&model.AuditLog{},
		&model.WebPushSubscription{},
		&model.WebPushEvent{},
		&model.ShareExternalUser{},
		&model.ShareEmailVerification{},
		&model.ShareAuthSettings{},
		&model.ShareMediaStorageSettings{},
		&model.ShareSiteBrandingSettings{},
		&model.SharePlatformCard{},
		&model.SharePlatformCardAsset{},
		&model.SharePlatformCardFavorite{},
		&model.SharePlatformDownloadLog{},
	); err != nil {
		return err
	}

	if err := backfillLegacyShareUserEmailVerified(db); err != nil {
		return err
	}
	if err := cleanupLegacyShareEmailVerifications(db); err != nil {
		return err
	}

	return backfillShareCardDownloadStats(db)
}

func backfillShareCardDownloadStats(db *gorm.DB) error {
	return db.Exec(`
		UPDATE share_platform_cards AS cards
		SET
			download_count = stats.download_count,
			last_downloaded_at = stats.last_downloaded_at
		FROM (
			SELECT
				card_id,
				COUNT(*) AS download_count,
				MAX(downloaded_at) AS last_downloaded_at
			FROM share_platform_download_logs
			GROUP BY card_id
		) AS stats
		WHERE cards.id = stats.card_id
		  AND (
			cards.download_count IS DISTINCT FROM stats.download_count
			OR cards.last_downloaded_at IS DISTINCT FROM stats.last_downloaded_at
		  )
	`).Error
}

func backfillLegacyShareUserEmailVerified(db *gorm.DB) error {
	return db.Exec(`
		UPDATE share_external_users
		SET
			email_verified = TRUE,
			email_verified_at = COALESCE(email_verified_at, created_at, NOW())
		WHERE COALESCE(email_verified, FALSE) = FALSE
	`).Error
}

func cleanupLegacyShareEmailVerifications(db *gorm.DB) error {
	return db.Exec(`
		DELETE FROM share_email_verifications
		WHERE expires_at < NOW()
		   OR (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '7 days')
	`).Error
}

// Close closes database connection.
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
