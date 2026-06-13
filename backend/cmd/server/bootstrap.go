package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/baobaobai/baobaobaivault/pkg/crypto"
	"github.com/baobaobai/baobaobaivault/pkg/database"
	"github.com/baobaobai/baobaobaivault/pkg/redis"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	defaultBackendImage      = "ghcr.io/chivalry1314/baobaobaivault-backend:latest"
	defaultFrontendImage     = "ghcr.io/chivalry1314/baobaobaivault-sharefrontend:latest"
	adminPasswordLength      = 16
	postgresPasswordLength   = 32
	redisPasswordLength      = 32
	jwtSecretLength          = 64
	fieldEncryptionKeyBytes  = 32
)

// bootstrapSecrets holds the random credentials generated for a fresh deployment.
type bootstrapSecrets struct {
	PostgresPassword    string
	RedisPassword       string
	JWTSecret           string
	FieldEncryptionKey  string
	BackendImage        string
	ShareFrontendImage  string
}

// GenerateSecureSecret returns a URL-safe random string of the requested length
// using the operating system's CSPRNG.
func GenerateSecureSecret(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("length must be positive")
	}
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", fmt.Errorf("generate random secret: %w", err)
		}
		result[i] = alphabet[n.Int64()]
	}
	return string(result), nil
}

// GenerateBase64Key returns a base64-encoded random key of byteLength bytes.
func GenerateBase64Key(byteLength int) (string, error) {
	if byteLength <= 0 {
		return "", errors.New("byte length must be positive")
	}
	key := make([]byte, byteLength)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("generate random key: %w", err)
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

func runBootstrap(args []string) error {
	fs := flag.NewFlagSet("bootstrap", flag.ExitOnError)
	adminEmail := fs.String("admin-email", "", "initial super admin email address")
	domain := fs.String("domain", "", "public frontend domain, e.g. share.example.com")
	outDir := fs.String("out", ".", "output directory for .env and backend/config/config.yaml")
	generateOnly := fs.Bool("generate-only", false, "only generate config files, do not create admin user")
	overwrite := fs.Bool("overwrite", false, "overwrite existing .env/config.yaml")
	backendImage := fs.String("backend-image", defaultBackendImage, "backend container image")
	frontendImage := fs.String("frontend-image", defaultFrontendImage, "frontend container image")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if strings.TrimSpace(*adminEmail) == "" {
		return errors.New("--admin-email is required")
	}
	if !strings.Contains(*adminEmail, "@") {
		return errors.New("--admin-email must be a valid email address")
	}
	if strings.TrimSpace(*domain) == "" {
		return errors.New("--domain is required")
	}

	outDirAbs, err := filepath.Abs(*outDir)
	if err != nil {
		return fmt.Errorf("resolve output directory: %w", err)
	}

	envPath := filepath.Join(outDirAbs, ".env")
	configDir := filepath.Join(outDirAbs, "backend", "config")
	configPath := filepath.Join(configDir, "config.yaml")

	if !*overwrite {
		if _, err := os.Stat(envPath); err == nil {
			return fmt.Errorf("%s already exists (use --overwrite to replace)", envPath)
		}
		if _, err := os.Stat(configPath); err == nil {
			return fmt.Errorf("%s already exists (use --overwrite to replace)", configPath)
		}
	}

	secrets, err := generateBootstrapSecrets(*backendImage, *frontendImage)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	if err := generateEnvFile(envPath, secrets); err != nil {
		return err
	}

	if err := generateConfigFile(configPath, secrets, *domain, *adminEmail); err != nil {
		return err
	}

	fmt.Printf("Generated configuration:\n")
	fmt.Printf("  %s\n", envPath)
	fmt.Printf("  %s\n", configPath)

	if *generateOnly {
		fmt.Println("\nRun 'docker compose up -d' to start services, then create the admin with 'server create-admin'.")
		return nil
	}

	// Switch to the output directory so config.Load finds the generated file.
	if err := os.Chdir(outDirAbs); err != nil {
		return fmt.Errorf("change to output directory: %w", err)
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load generated config: %w", err)
	}

	if err := crypto.SetFieldEncryptionKey(cfg.Security.FieldEncryptionKey); err != nil {
		return fmt.Errorf("configure field encryption: %w", err)
	}

	logger, err := zap.NewProduction()
	if err != nil {
		return fmt.Errorf("init logger: %w", err)
	}
	defer logger.Sync()

	db, err := database.NewPostgresDB(cfg.Server, cfg.Database, logger)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer database.Close(db)

	rdb, err := redis.NewClient(cfg.Redis, logger)
	if err != nil {
		return fmt.Errorf("connect redis: %w", err)
	}
	defer redis.Close(rdb)

	if err := database.AutoMigrate(db); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}

	adminPassword, err := GenerateSecureSecret(adminPasswordLength)
	if err != nil {
		return fmt.Errorf("generate admin password: %w", err)
	}

	if err := createOrUpdateAdmin(db, *adminEmail, adminPassword, logger); err != nil {
		return fmt.Errorf("create admin user: %w", err)
	}

	fmt.Printf("\nInitial super admin created:\n")
	fmt.Printf("  Email:    %s\n", *adminEmail)
	fmt.Printf("  Password: %s\n", adminPassword)
	fmt.Println("\nSave this password. It will not be shown again.")
	return nil
}

func generateBootstrapSecrets(backendImage, frontendImage string) (bootstrapSecrets, error) {
	var s bootstrapSecrets
	var err error
	s.PostgresPassword, err = GenerateSecureSecret(postgresPasswordLength)
	if err != nil {
		return s, fmt.Errorf("generate postgres password: %w", err)
	}
	s.RedisPassword, err = GenerateSecureSecret(redisPasswordLength)
	if err != nil {
		return s, fmt.Errorf("generate redis password: %w", err)
	}
	s.JWTSecret, err = GenerateSecureSecret(jwtSecretLength)
	if err != nil {
		return s, fmt.Errorf("generate jwt secret: %w", err)
	}
	s.FieldEncryptionKey, err = GenerateBase64Key(fieldEncryptionKeyBytes)
	if err != nil {
		return s, fmt.Errorf("generate field encryption key: %w", err)
	}
	s.BackendImage = backendImage
	if strings.TrimSpace(s.BackendImage) == "" {
		s.BackendImage = defaultBackendImage
	}
	s.ShareFrontendImage = frontendImage
	if strings.TrimSpace(s.ShareFrontendImage) == "" {
		s.ShareFrontendImage = defaultFrontendImage
	}
	return s, nil
}

func generateEnvFile(path string, s bootstrapSecrets) error {
	content := fmt.Sprintf(`POSTGRES_DB=baobaobaivault
POSTGRES_USER=vaultuser
POSTGRES_PASSWORD=%s
REDIS_PASSWORD=%s

# Replace the tags if you want a pinned release instead of latest.
BACKEND_IMAGE=%s
SHAREFRONTEND_IMAGE=%s
`, s.PostgresPassword, s.RedisPassword, s.BackendImage, s.ShareFrontendImage)

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

func generateConfigFile(path string, s bootstrapSecrets, domain, adminEmail string) error {
	tmpl := `server:
  port: "8080"
  read_timeout: 30
  write_timeout: 30
  mode: release
  admin_email: "%s"

cors:
  enabled: true
  allow_origins:
    - "https://%s"
  allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  allow_headers: ["Authorization", "Content-Type", "X-Requested-With", "X-Timestamp"]
  expose_headers: ["Content-Disposition", "Content-Length", "ETag"]
  allow_credentials: true
  max_age: 86400

database:
  host: "postgres"
  port: 5432
  user: "vaultuser"
  password: "%s"
  dbname: "baobaobaivault"
  sslmode: "disable"
  max_open_conns: 20
  max_idle_conns: 5
  conn_max_lifetime: 3600

redis:
  host: "redis"
  port: 6379
  password: "%s"
  db: 0

jwt:
  secret: "%s"
  expire_time: 24h
  issuer: "baobaobaivault"

security:
  field_encryption_key: "%s"

storage:
  default_provider: "local"
  temp_dir: "/tmp/baobaobaivault"
  max_file_size: 10737418240

webpush:
  enabled: false
  public_api_enabled: false
  vapid_subject: "mailto:admin@example.com"
  vapid_public_key: ""
  vapid_private_key: ""
  allow_vapid_auto_generate: false
  default_ttl_seconds: 300
  dispatch_api_key: ""
  queue_concurrency: 20
  queue_buffer: 1000
  push_proxy_url: ""

email:
  enabled: false
  from_name: "CardShare"
  from_address: "noreply@example.com"
  smtp_host: "smtp.example.com"
  smtp_port: 587
  smtp_username: "noreply@example.com"
  smtp_password: "change-this-smtp-password"

share_auth:
  email_verification_enabled: false
  verification_code_ttl_seconds: 600
  resend_interval_seconds: 60
  max_verify_attempts: 5

log:
  level: "info"
  format: "json"
`
	content := fmt.Sprintf(tmpl,
		adminEmail,
		domain,
		s.PostgresPassword,
		s.RedisPassword,
		s.JWTSecret,
		s.FieldEncryptionKey,
	)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// createOrUpdateAdmin ensures a manager account exists for the given email.
// It is shared by the create-admin and bootstrap subcommands.
func createOrUpdateAdmin(db *gorm.DB, email, password string, logger *zap.Logger) error {
	ctx := context.Background()
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return errors.New("admin email is required")
	}
	if strings.TrimSpace(password) == "" {
		return errors.New("admin password is required")
	}
	if len(password) < 6 {
		return errors.New("admin password must be at least 6 characters")
	}

	adminUsername := strings.Split(email, "@")[0]
	adminUsername = strings.ToLower(strings.TrimSpace(adminUsername))
	if adminUsername == "" {
		adminUsername = "admin"
	}

	var user model.ShareExternalUser
	err := db.WithContext(ctx).First(&user, "email = ?", email).Error
	isNew := false
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			isNew = true
			user = model.ShareExternalUser{}
		} else {
			return fmt.Errorf("query admin user: %w", err)
		}
	}

	now := time.Now().UTC()
	user.Email = email
	user.Username = adminUsername
	user.Nickname = "System Administrator"
	user.Role = model.ShareExternalUserRoleManager
	user.Status = model.ShareExternalUserStatusActive
	user.EmailVerified = true
	verifiedAt := now
	user.EmailVerifiedAt = &verifiedAt
	user.ForcePasswordChange = false

	if err := user.SetPassword(password); err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	if isNew {
		if err := db.WithContext(ctx).Create(&user).Error; err != nil {
			return fmt.Errorf("create admin user: %w", err)
		}
		logger.Info("admin user created", zap.String("email", email))
	} else {
		if err := db.WithContext(ctx).Save(&user).Error; err != nil {
			return fmt.Errorf("update admin user: %w", err)
		}
		logger.Info("admin user updated", zap.String("email", email))
	}
	return nil
}
