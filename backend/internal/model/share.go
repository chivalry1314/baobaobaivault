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

	SharePlatformCardVisibilityPrivate = "private"
	SharePlatformCardVisibilityPublic  = "public"

	SharePlatformCardStatusDraft     = "draft"
	SharePlatformCardStatusPublished = "published"
	SharePlatformCardStatusArchived  = "archived"
)

// ShareExternalUser is the platform-level account for sharefrontend users.
type ShareExternalUser struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email       string         `gorm:"type:varchar(120);not null;uniqueIndex" json:"email"`
	Username    string         `gorm:"type:varchar(40);not null;uniqueIndex" json:"username"`
	Password    string         `gorm:"type:varchar(255);not null" json:"-"`
	Nickname    string         `gorm:"type:varchar(80);not null" json:"nickname"`
	Avatar      string         `gorm:"type:text;default:''" json:"avatar"`
	Bio         string         `gorm:"type:text;default:''" json:"bio"`
	CoverImage  string         `gorm:"type:text;default:''" json:"cover_image"`
	Phone       string         `gorm:"type:varchar(30);default:''" json:"phone"`
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
	Visibility            string         `gorm:"type:varchar(20);not null;default:'private';index" json:"visibility"`
	Status                string         `gorm:"type:varchar(20);not null;default:'published';index" json:"status"`
	AccessCode            string         `gorm:"type:varchar(64);default:''" json:"access_code"`
	AccessCodeExpiresAt   *time.Time     `json:"access_code_expires_at,omitempty"`
	AccessCodeUsageLimit  int            `gorm:"not null;default:0" json:"access_code_usage_limit"`
	AccessCodeUsageCount  int            `gorm:"not null;default:0" json:"access_code_usage_count"`
	StoredFileName        string         `gorm:"type:varchar(255);not null" json:"stored_file_name"`
	OriginalFileName      string         `gorm:"type:varchar(255);not null" json:"original_file_name"`
	MimeType              string         `gorm:"type:varchar(200);not null" json:"mime_type"`
	Size                  int64          `gorm:"not null" json:"size"`
	CreatedAt             time.Time      `gorm:"index:idx_share_platform_cards_creator_created,priority:2" json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`

	Creator *ShareExternalUser `gorm:"foreignKey:CreatorExternalUserID" json:"creator,omitempty"`
}

func (SharePlatformCard) TableName() string {
	return "share_platform_cards"
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
