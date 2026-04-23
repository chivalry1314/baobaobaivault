package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Cors     CorsConfig     `mapstructure:"cors"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Storage  StorageConfig  `mapstructure:"storage"`
	Baidu    BaiduConfig    `mapstructure:"baidu"`
	WebPush  WebPushConfig  `mapstructure:"webpush"`
	Log      LogConfig      `mapstructure:"log"`
}

type ServerConfig struct {
	Port                       string `mapstructure:"port"`
	ReadTimeout                int    `mapstructure:"read_timeout"`
	WriteTimeout               int    `mapstructure:"write_timeout"`
	Mode                       string `mapstructure:"mode"` // debug, release, test
	AllowPublicBootstrap       bool   `mapstructure:"allow_public_bootstrap"`
	AutoBootstrapPlatformAdmin bool   `mapstructure:"auto_bootstrap_platform_admin"`
	PlatformAdminTenantCode    string `mapstructure:"platform_admin_tenant_code"`
	PlatformAdminEmail         string `mapstructure:"platform_admin_email"`
	PlatformAdminPassword      string `mapstructure:"platform_admin_password"`
	PlatformAdminUsername      string `mapstructure:"platform_admin_username"`
	PlatformAdminNickname      string `mapstructure:"platform_admin_nickname"`
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

type BaiduConfig struct {
	Enabled            bool   `mapstructure:"enabled"`
	APIKey             string `mapstructure:"api_key"`
	SecretKey          string `mapstructure:"secret_key"`
	RedirectURI        string `mapstructure:"redirect_uri"`
	Scope              string `mapstructure:"scope"`
	AuthURL            string `mapstructure:"auth_url"`
	AuthExtraParams    map[string]string `mapstructure:"auth_extra_params"`
	TokenURL           string `mapstructure:"token_url"`
	PanAPIBaseURL      string `mapstructure:"pan_api_base_url"`
	PanUploadURL       string `mapstructure:"pan_upload_url"`
	DefaultPathPrefix  string `mapstructure:"default_path_prefix"`
	StateSecret        string `mapstructure:"state_secret"`
	TokenEncryptSecret string `mapstructure:"token_encrypt_secret"`
	HTTPTimeoutSeconds int    `mapstructure:"http_timeout_seconds"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"` // json, console
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
	viper.SetDefault("server.allow_public_bootstrap", false)
	viper.SetDefault("server.auto_bootstrap_platform_admin", false)
	viper.SetDefault("server.platform_admin_tenant_code", "platform")
	viper.SetDefault("server.platform_admin_email", "")
	viper.SetDefault("server.platform_admin_password", "")
	viper.SetDefault("server.platform_admin_username", "platform_admin")
	viper.SetDefault("server.platform_admin_nickname", "platform admin")

	// CORS
	viper.SetDefault("cors.enabled", true)
	viper.SetDefault("cors.allow_origins", []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:4173",
		"http://127.0.0.1:4173",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	})
	viper.SetDefault("cors.allow_methods", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allow_headers", []string{"Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"})
	viper.SetDefault("cors.expose_headers", []string{"Content-Disposition", "Content-Length", "ETag"})
	viper.SetDefault("cors.allow_credentials", false)
	viper.SetDefault("cors.max_age", 86400)

	// Database
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "postgres")
	viper.SetDefault("database.dbname", "baobaobaivault")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 100)
	viper.SetDefault("database.max_idle_conns", 10)
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

	// Baidu netdisk connector
	viper.SetDefault("baidu.enabled", false)
	viper.SetDefault("baidu.api_key", "")
	viper.SetDefault("baidu.secret_key", "")
	viper.SetDefault("baidu.redirect_uri", "http://127.0.0.1:8080/api/v1/connectors/baidu/callback")
	viper.SetDefault("baidu.scope", "basic,netdisk")
	viper.SetDefault("baidu.auth_url", "https://openapi.baidu.com/oauth/2.0/authorize")
	viper.SetDefault("baidu.auth_extra_params", map[string]string{})
	viper.SetDefault("baidu.token_url", "https://openapi.baidu.com/oauth/2.0/token")
	viper.SetDefault("baidu.pan_api_base_url", "https://pan.baidu.com/rest/2.0")
	viper.SetDefault("baidu.pan_upload_url", "https://d.pcs.baidu.com/rest/2.0/pcs/superfile2")
	viper.SetDefault("baidu.default_path_prefix", "/apps/baobaobaiphone/backups")
	viper.SetDefault("baidu.state_secret", "")
	viper.SetDefault("baidu.token_encrypt_secret", "")
	viper.SetDefault("baidu.http_timeout_seconds", 30)

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
}

func (c *Config) validate() error {
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
