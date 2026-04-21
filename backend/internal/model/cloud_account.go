package model

import "time"

import "gorm.io/gorm"

// CloudAccount stores third-party cloud account bindings per user.
type CloudAccount struct {
	ID              string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID        string     `gorm:"type:uuid;not null;uniqueIndex:idx_cloud_account_owner,priority:1;index" json:"tenant_id"`
	UserID          string     `gorm:"type:uuid;not null;uniqueIndex:idx_cloud_account_owner,priority:2;index" json:"user_id"`
	Provider        string     `gorm:"type:varchar(32);not null;uniqueIndex:idx_cloud_account_owner,priority:3;index" json:"provider"`
	ExternalUserID  string     `gorm:"type:varchar(128);default:''" json:"external_user_id"`
	DisplayName     string     `gorm:"type:varchar(128);default:''" json:"display_name"`
	AccessTokenEnc  string     `gorm:"type:text;not null" json:"-"`
	RefreshTokenEnc string     `gorm:"type:text;not null" json:"-"`
	Scope           string     `gorm:"type:text;default:''" json:"scope"`
	Status          string     `gorm:"type:varchar(20);default:'active';index" json:"status"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	Extra           string     `gorm:"type:text;default:''" json:"extra"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

const (
	CloudProviderBaiduPan = "baidu_pan"
)

const (
	CloudAccountStatusActive   = "active"
	CloudAccountStatusInactive = "inactive"
	CloudAccountStatusError    = "error"
)

func (CloudAccount) TableName() string {
	return "cloud_accounts"
}
