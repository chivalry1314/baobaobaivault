package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server              ServerConfig    `mapstructure:"server"`
	Cors                CorsConfig      `mapstructure:"cors"`
	SharePublicReadCors CorsConfig      `mapstructure:"share_public_read_cors"`
	Database            DatabaseConfig  `mapstructure:"database"`
	Redis               RedisConfig     `mapstructure:"redis"`
	JWT                 JWTConfig       `mapstructure:"jwt"`
	Storage             StorageConfig   `mapstructure:"storage"`
	WebPush             WebPushConfig   `mapstructure:"webpush"`
	Email               EmailConfig     `mapstructure:"email"`
	ShareAuth           ShareAuthConfig `mapstructure:"share_auth"`
	Security            SecurityConfig  `mapstructure:"security"`
	Log                 LogConfig       `mapstructure:"log"`
}

type ServerConfig struct {
	Port         string `mapstructure:"port"`
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
	Mode         string `mapstructure:"mode"` // debug, release, test
	AdminEmail   string `mapstructure:"admin_email"`
}

type CorsConfig struct {
	Enabled          bool     `mapstructure:"enabled"`
	AllowOrigins     []string `mapstructure:"allow_origins"`
	AllowMethods     []string `mapstructure:"allow_methods"`
	AllowHeaders     []string `mapstructure:"allow_headers"`
	ExposeHeaders    []string `mapstructure:"expose_headers"`
	AllowCredentials bool     `mapstructure:"allow_credentials"`
	MaxAge           int      `mapstructure:"max_age"`
}

type DatabaseConfig struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	DBName          string `mapstructure:"dbname"`
	SSLMode         string `mapstructure:"sslmode"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host,
		d.Port,
		d.User,
		d.Password,
		d.DBName,
		d.SSLMode,
	)
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type JWTConfig struct {
	Secret     string        `mapstructure:"secret"`
	ExpireTime time.Duration `mapstructure:"expire_time"`
	Issuer     string        `mapstructure:"issuer"`
}

type StorageConfig struct {
	DefaultProvider string `mapstructure:"default_provider"`
	TempDir         string `mapstructure:"temp_dir"`
	MaxFileSize     int64  `mapstructure:"max_file_size"` // bytes
}

type EmailConfig struct {
	Enabled      bool   `mapstructure:"enabled"`
	FromName     string `mapstructure:"from_name"`
	FromAddress  string `mapstructure:"from_address"`
	SMTPHost     string `mapstructure:"smtp_host"`
	SMTPPort     int    `mapstructure:"smtp_port"`
	SMTPUsername string `mapstructure:"smtp_username"`
	SMTPPassword string `mapstructure:"smtp_password"`
}

type ShareAuthConfig struct {
	EmailVerificationEnabled   bool `mapstructure:"email_verification_enabled"`
	VerificationCodeTTLSeconds int  `mapstructure:"verification_code_ttl_seconds"`
	ResendIntervalSeconds      int  `mapstructure:"resend_interval_seconds"`
	MaxVerifyAttempts          int  `mapstructure:"max_verify_attempts"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"` // json, console
}

type SecurityConfig struct {
	// FieldEncryptionKey is a 16/24/32 byte AES key used to encrypt sensitive
	// database fields such as object storage credentials.
	// It can be provided as a base64-encoded string or a raw string.
	FieldEncryptionKey string `mapstructure:"field_encryption_key"`
}

type WebPushConfig struct {
	Enabled           bool   `mapstructure:"enabled"`
	PublicAPIEnabled  bool   `mapstructure:"public_api_enabled"`
	VAPIDSubject      string `mapstructure:"vapid_subject"`
	VAPIDPublicKey    string `mapstructure:"vapid_public_key"`
	VAPIDPrivateKey   string `mapstructure:"vapid_private_key"`
	AllowVAPIDAutoGen bool   `mapstructure:"allow_vapid_auto_generate"`

	DefaultTTLSeconds int    `mapstructure:"default_ttl_seconds"`
	DispatchAPIKey    string `mapstructure:"dispatch_api_key"`

	QueueConcurrency int    `mapstructure:"queue_concurrency"`
	QueueBuffer      int    `mapstructure:"queue_buffer"`
	PushProxyURL     string `mapstructure:"push_proxy_url"`
}

// Load 鍔犺浇閰嶇疆鏂囦欢
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("./backend/config")
	viper.AddConfigPath("/etc/baobaobaivault")

	// 鐜鍙橀噺
	viper.AutomaticEnv()
	viper.SetEnvPrefix("BVAULT")

	// 榛樿鍊?	setDefaults()

	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func setDefaults() {
	// Server
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.read_timeout", 30)
	viper.SetDefault("server.write_timeout", 30)
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.admin_email", "")

	// CORS
	viper.SetDefault("cors.enabled", true)
	viper.SetDefault("cors.allow_origins", []string{
		"http://localhost:3002",
		"http://127.0.0.1:3002",
		"http://localhost:3001",
		"http://127.0.0.1:3001",
		"http://localhost:4173",
		"http://127.0.0.1:4173",
		"http://localhost:*",
		"http://127.0.0.1:*",
	})
	viper.SetDefault("cors.allow_methods", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allow_headers", []string{"Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"})
	viper.SetDefault("cors.expose_headers", []string{"Content-Disposition", "Content-Length", "ETag"})
	viper.SetDefault("cors.allow_credentials", false)
	viper.SetDefault("cors.max_age", 86400)

	// Public read CORS for share query/download endpoints.
	// This keeps public card/theme discovery accessible like a query API
	// without weakening authenticated write/admin endpoints.
	viper.SetDefault("share_public_read_cors.enabled", true)
	viper.SetDefault("share_public_read_cors.allow_origins", []string{"*"})
	viper.SetDefault("share_public_read_cors.allow_methods", []string{"GET", "HEAD", "OPTIONS"})
	viper.SetDefault("share_public_read_cors.allow_headers", []string{"*"})
	viper.SetDefault("share_public_read_cors.expose_headers", []string{"Content-Disposition", "Content-Length", "ETag"})
	viper.SetDefault("share_public_read_cors.allow_credentials", false)
	viper.SetDefault("share_public_read_cors.max_age", 86400)

	// Database
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "postgres")
	viper.SetDefault("database.dbname", "baobaobaivault")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 20)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", 3600)

	// Redis
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// JWT
	viper.SetDefault("jwt.secret", "your-secret-key-change-in-production")
	viper.SetDefault("jwt.expire_time", "24h")
	viper.SetDefault("jwt.issuer", "baobaobaivault")

	// Storage
	viper.SetDefault("storage.default_provider", "local")
	viper.SetDefault("storage.temp_dir", "/tmp/baobaobaivault")
	viper.SetDefault("storage.max_file_size", 10737418240) // 10GB

	// Email
	viper.SetDefault("email.enabled", false)
	viper.SetDefault("email.from_name", "CardShare")
	viper.SetDefault("email.from_address", "")
	viper.SetDefault("email.smtp_host", "")
	viper.SetDefault("email.smtp_port", 587)
	viper.SetDefault("email.smtp_username", "")
	viper.SetDefault("email.smtp_password", "")

	// Share auth
	viper.SetDefault("share_auth.email_verification_enabled", false)
	viper.SetDefault("share_auth.verification_code_ttl_seconds", 600)
	viper.SetDefault("share_auth.resend_interval_seconds", 60)
	viper.SetDefault("share_auth.max_verify_attempts", 5)

	// Web Push (optional)
	viper.SetDefault("webpush.enabled", false)
	viper.SetDefault("webpush.public_api_enabled", false)
	viper.SetDefault("webpush.vapid_subject", "mailto:push-admin@example.com")
	viper.SetDefault("webpush.vapid_public_key", "")
	viper.SetDefault("webpush.vapid_private_key", "")
	viper.SetDefault("webpush.allow_vapid_auto_generate", false)
	viper.SetDefault("webpush.default_ttl_seconds", 300)
	viper.SetDefault("webpush.dispatch_api_key", "")
	viper.SetDefault("webpush.queue_concurrency", 20)
	viper.SetDefault("webpush.queue_buffer", 1000)
	viper.SetDefault("webpush.push_proxy_url", "")

	// Log
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.format", "json")

	// Security
	viper.SetDefault("security.field_encryption_key", "")
}

func (c *Config) validate() error {
	if strings.TrimSpace(c.Server.AdminEmail) == "" {
		return fmt.Errorf("server.admin_email is required")
	}
	if c.Server.Mode == "release" {
		if len(c.JWT.Secret) < 32 {
			return fmt.Errorf("jwt.secret must be at least 32 characters in release mode")
		}
		if len(c.Security.FieldEncryptionKey) == 0 {
			return fmt.Errorf("security.field_encryption_key is required in release mode")
		}
	}
	if c.ShareAuth.VerificationCodeTTLSeconds <= 0 {
		c.ShareAuth.VerificationCodeTTLSeconds = 600
	}
	if c.ShareAuth.ResendIntervalSeconds <= 0 {
		c.ShareAuth.ResendIntervalSeconds = 60
	}
	if c.ShareAuth.MaxVerifyAttempts <= 0 {
		c.ShareAuth.MaxVerifyAttempts = 5
	}
	if c.ShareAuth.EmailVerificationEnabled {
		if !c.Email.Enabled {
			return fmt.Errorf("share_auth.email_verification_enabled requires email.enabled = true")
		}
		if c.Email.SMTPHost == "" || c.Email.SMTPPort <= 0 || c.Email.FromAddress == "" {
			return fmt.Errorf("email verification requires email.smtp_host, email.smtp_port, and email.from_address")
		}
	}
	if c.Email.Enabled {
		if c.Email.FromName == "" {
			c.Email.FromName = "CardShare"
		}
		if c.Email.SMTPPort <= 0 {
			c.Email.SMTPPort = 587
		}
	}
	if !c.WebPush.Enabled {
		return nil
	}
	if c.WebPush.DefaultTTLSeconds <= 0 {
		c.WebPush.DefaultTTLSeconds = 300
	}
	if c.WebPush.QueueConcurrency <= 0 {
		c.WebPush.QueueConcurrency = 20
	}
	if c.WebPush.QueueBuffer <= 0 {
		c.WebPush.QueueBuffer = 1000
	}
	if c.WebPush.VAPIDSubject == "" {
		c.WebPush.VAPIDSubject = "mailto:push-admin@example.com"
	}
	if (c.WebPush.VAPIDPublicKey == "" || c.WebPush.VAPIDPrivateKey == "") && !c.WebPush.AllowVAPIDAutoGen {
		return fmt.Errorf("webpush enabled but VAPID keys are missing (set webpush.vapid_public_key / webpush.vapid_private_key or enable webpush.allow_vapid_auto_generate)")
	}
	return nil
}
