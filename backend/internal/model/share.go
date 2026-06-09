package model

import (
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	ShareExternalUserStatusActive   = "active"
	ShareExternalUserStatusInactive = "inactive"
	ShareExternalUserStatusLocked   = "locked"

	ShareExternalUserRoleViewer  = "viewer"
	ShareExternalUserRoleCreator = "creator"
	ShareExternalUserRoleManager = "manager"

	SharePlatformCardVisibilityPrivate = "private"
	SharePlatformCardVisibilityPublic  = "public"

	SharePlatformCardStatusDraft     = "draft"
	SharePlatformCardStatusPublished = "published"
	SharePlatformCardStatusArchived  = "archived"

	SharePlatformCardReviewStatusUnsubmitted = "unsubmitted"
	SharePlatformCardReviewStatusPending     = "pending"
	SharePlatformCardReviewStatusApproved    = "approved"
	SharePlatformCardReviewStatusRejected    = "rejected"

	SharePlatformCardAccessModeFree = "free"
	SharePlatformCardAccessModePaid = "paid"

	ShareMediaStorageModeLocal         = "local"
	ShareMediaStorageModeObjectStorage = "object_storage"
)

// ShareExternalUser is the platform-level account for sharefrontend users.
type ShareExternalUser struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email       string         `gorm:"type:varchar(120);not null;uniqueIndex" json:"email"`
	Username    string         `gorm:"type:varchar(40);not null;uniqueIndex" json:"username"`
	Password    string         `gorm:"type:varchar(255);not null" json:"-"`
	EmailVerified bool         `gorm:"not null;default:false" json:"email_verified"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	Nickname    string         `gorm:"type:varchar(80);not null" json:"nickname"`
	Avatar      string         `gorm:"type:text;default:''" json:"avatar"`
	Bio         string         `gorm:"type:text;default:''" json:"bio"`
	CoverImage  string         `gorm:"type:text;default:''" json:"cover_image"`
	Phone       string         `gorm:"type:varchar(30);default:''" json:"phone"`
	Role        string         `gorm:"type:varchar(20);not null;default:'viewer';index" json:"role"`
	Status      string         `gorm:"type:varchar(20);not null;default:'active'" json:"status"`
	LastLoginAt *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ShareExternalUser) TableName() string {
	return "share_external_users"
}

func (u *ShareExternalUser) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

func (u *ShareExternalUser) CheckPassword(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)) == nil
}

func (u *ShareExternalUser) NormalizedDisplayName() string {
	displayName := strings.TrimSpace(u.Nickname)
	if displayName != "" {
		return displayName
	}
	return u.Username
}

// SharePlatformCard stores platform-level cards created by sharefrontend users.
type SharePlatformCard struct {
	ID                    string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CreatorExternalUserID string         `gorm:"type:uuid;not null;index:idx_share_platform_cards_creator_created,priority:1" json:"creator_external_user_id"`
	Title                 string         `gorm:"type:varchar(200);not null" json:"title"`
	Description           string         `gorm:"type:text;default:''" json:"description"`
	Visibility            string         `gorm:"type:varchar(20);not null;default:'private';index;index:idx_share_platform_cards_discover,priority:1" json:"visibility"`
	Status                string         `gorm:"type:varchar(20);not null;default:'published';index;index:idx_share_platform_cards_discover,priority:2" json:"status"`
	ReviewStatus          string         `gorm:"type:varchar(20);not null;default:'unsubmitted';index;index:idx_share_platform_cards_discover,priority:3" json:"review_status"`
	AccessMode            string         `gorm:"type:varchar(20);not null;default:'free';index" json:"access_mode"`
	ReviewReason          string         `gorm:"type:text;default:''" json:"review_reason"`
	ReviewerExternalUserID *string       `gorm:"type:uuid;index" json:"reviewer_external_user_id,omitempty"`
	SubmittedAt           *time.Time     `json:"submitted_at,omitempty"`
	ReviewedAt            *time.Time     `json:"reviewed_at,omitempty"`
	AccessCode            string         `gorm:"type:varchar(64);default:''" json:"access_code"`
	AccessCodeExpiresAt   *time.Time     `json:"access_code_expires_at,omitempty"`
	AccessCodeUsageLimit  int            `gorm:"not null;default:0" json:"access_code_usage_limit"`
	AccessCodeUsageCount  int            `gorm:"not null;default:0" json:"access_code_usage_count"`
	StorageBackend        string         `gorm:"type:varchar(32);not null;default:'local'" json:"storage_backend"`
	StorageNamespaceID    *string        `gorm:"type:uuid;index" json:"storage_namespace_id,omitempty"`
	StorageObjectKey      string         `gorm:"type:varchar(1024);default:''" json:"storage_object_key"`
	StorageVersionID      string         `gorm:"type:varchar(255);default:''" json:"storage_version_id"`
	StoredFileName        string         `gorm:"type:varchar(255);not null" json:"stored_file_name"`
	OriginalFileName      string         `gorm:"type:varchar(255);not null" json:"original_file_name"`
	MimeType              string         `gorm:"type:varchar(200);not null" json:"mime_type"`
	Size                  int64          `gorm:"not null" json:"size"`
	DownloadCount         int64          `gorm:"not null;default:0" json:"download_count"`
	LastDownloadedAt      *time.Time     `json:"last_downloaded_at,omitempty"`
	CreatedAt             time.Time      `gorm:"index:idx_share_platform_cards_creator_created,priority:2" json:"created_at"`
	UpdatedAt             time.Time      `gorm:"index:idx_share_platform_cards_discover,priority:4" json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`

	Creator *ShareExternalUser `gorm:"foreignKey:CreatorExternalUserID" json:"creator,omitempty"`
}

func (SharePlatformCard) TableName() string {
	return "share_platform_cards"
}

// SharePlatformCardAsset stores card files grouped by fixed content slots.
type SharePlatformCardAsset struct {
	ID               string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CardID           string         `gorm:"type:uuid;not null;uniqueIndex:idx_share_platform_card_assets_card_slot,priority:1;index" json:"card_id"`
	Slot             string         `gorm:"type:varchar(40);not null;uniqueIndex:idx_share_platform_card_assets_card_slot,priority:2;index" json:"slot"`
	StorageBackend   string         `gorm:"type:varchar(32);not null;default:'local'" json:"storage_backend"`
	StorageNamespaceID *string      `gorm:"type:uuid;index" json:"storage_namespace_id,omitempty"`
	StorageObjectKey string         `gorm:"type:varchar(1024);default:''" json:"storage_object_key"`
	StorageVersionID string         `gorm:"type:varchar(255);default:''" json:"storage_version_id"`
	StoredFileName   string         `gorm:"type:varchar(255);not null" json:"stored_file_name"`
	OriginalFileName string         `gorm:"type:varchar(255);not null" json:"original_file_name"`
	MimeType         string         `gorm:"type:varchar(200);not null" json:"mime_type"`
	Size             int64          `gorm:"not null" json:"size"`
	SortOrder        int            `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (SharePlatformCardAsset) TableName() string {
	return "share_platform_card_assets"
}

// SharePlatformDownloadLog records downloads for discover metrics.
type SharePlatformDownloadLog struct {
	ID                       string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CardID                   string    `gorm:"type:uuid;not null;index" json:"card_id"`
	DownloaderExternalUserID *string   `gorm:"type:uuid;index" json:"downloader_external_user_id"`
	Source                   string    `gorm:"type:varchar(20);not null" json:"source"`
	DownloadedAt             time.Time `gorm:"index" json:"downloaded_at"`
}

func (SharePlatformDownloadLog) TableName() string {
	return "share_platform_download_logs"
}

type ShareEmailVerification struct {
	ID            string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email         string         `gorm:"type:varchar(120);not null;index:idx_share_email_verifications_email_purpose,priority:1" json:"email"`
	Purpose       string         `gorm:"type:varchar(40);not null;index:idx_share_email_verifications_email_purpose,priority:2" json:"purpose"`
	Nickname      string         `gorm:"type:varchar(80);not null" json:"nickname"`
	PasswordHash  string         `gorm:"type:varchar(255);not null" json:"-"`
	CodeHash      string         `gorm:"type:varchar(255);not null" json:"-"`
	ExpiresAt     time.Time      `gorm:"index" json:"expires_at"`
	AttemptCount  int            `gorm:"not null;default:0" json:"attempt_count"`
	ConsumedAt    *time.Time     `json:"consumed_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ShareEmailVerification) TableName() string {
	return "share_email_verifications"
}

type ShareAuthSettings struct {
	Singleton                 string    `gorm:"type:varchar(32);primaryKey" json:"singleton"`
	EmailVerificationEnabled  bool      `gorm:"not null;default:false" json:"email_verification_enabled"`
	VerificationCodeTTLSeconds int      `gorm:"not null;default:600" json:"verification_code_ttl_seconds"`
	ResendIntervalSeconds     int       `gorm:"not null;default:60" json:"resend_interval_seconds"`
	MaxVerifyAttempts         int       `gorm:"not null;default:5" json:"max_verify_attempts"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

func (ShareAuthSettings) TableName() string {
	return "share_auth_settings"
}

type ShareMediaStorageSettings struct {
	Singleton            string    `gorm:"type:varchar(32);primaryKey" json:"singleton"`
	StorageMode          string    `gorm:"type:varchar(32);not null;default:'local'" json:"storage_mode"`
	LocalFallbackEnabled bool      `gorm:"not null;default:true" json:"local_fallback_enabled"`
	CoverNamespaceID     *string   `gorm:"type:uuid" json:"cover_namespace_id,omitempty"`
	AssetNamespaceID     *string   `gorm:"type:uuid" json:"asset_namespace_id,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (ShareMediaStorageSettings) TableName() string {
	return "share_media_storage_settings"
}
