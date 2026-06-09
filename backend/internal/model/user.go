package model

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User represents a platform account.
type User struct {
	ID       string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Username string     `gorm:"type:varchar(50);not null;uniqueIndex" json:"username"`
	Email    string     `gorm:"type:varchar(100);not null;uniqueIndex" json:"email"`
	Password string     `gorm:"type:varchar(255);not null" json:"-"`
	Nickname string     `gorm:"type:varchar(100)" json:"nickname"`
	Avatar   string     `gorm:"type:varchar(500)" json:"avatar"`
	Status   UserStatus `gorm:"type:varchar(20);default:'active'" json:"status"`

	LastLoginAt *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Roles     []Role     `gorm:"many2many:user_roles;" json:"roles,omitempty"`
	AKSKs     []AKSK     `gorm:"foreignKey:UserID" json:"ak_sks,omitempty"`
	AuditLogs []AuditLog `gorm:"foreignKey:UserID" json:"audit_logs,omitempty"`
}

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusInactive UserStatus = "inactive"
	UserStatusLocked   UserStatus = "locked"
)

const (
	RoleCodeAdmin = "admin"
)

func (User) TableName() string {
	return "users"
}

// SetPassword hashes and stores password.
func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword compares raw password with hash.
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// Role defines RBAC role metadata.
type Role struct {
	ID          string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Code        string `gorm:"type:varchar(50);not null;uniqueIndex" json:"code"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	IsSystem    bool   `gorm:"default:false" json:"is_system"`
	Level       int    `gorm:"default:0" json:"level"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Permissions []Permission `gorm:"many2many:role_permissions;" json:"permissions,omitempty"`
	Users       []User       `gorm:"many2many:user_roles;" json:"users,omitempty"`
	Namespaces  []Namespace  `gorm:"many2many:role_namespaces;" json:"namespaces,omitempty"`
}

func (Role) TableName() string {
	return "roles"
}

// Permission defines resource action pair.
type Permission struct {
	ID          string           `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Code        string           `gorm:"type:varchar(100);not null;uniqueIndex" json:"code"`
	Name        string           `gorm:"type:varchar(100);not null" json:"name"`
	Description string           `gorm:"type:text" json:"description"`
	Resource    string           `gorm:"type:varchar(100);not null" json:"resource"`
	Action      PermissionAction `gorm:"type:varchar(20);not null" json:"action"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Roles []Role `gorm:"many2many:role_permissions;" json:"roles,omitempty"`
}

type PermissionAction string

const (
	ActionCreate PermissionAction = "create"
	ActionRead   PermissionAction = "read"
	ActionUpdate PermissionAction = "update"
	ActionDelete PermissionAction = "delete"
	ActionList   PermissionAction = "list"
	ActionShare  PermissionAction = "share"
	ActionAdmin  PermissionAction = "admin"
)

func (Permission) TableName() string {
	return "permissions"
}

// RoleNamespace binds role to allowed namespaces for ABAC scope control.
type RoleNamespace struct {
	RoleID      string `gorm:"type:uuid;primaryKey" json:"role_id"`
	NamespaceID string `gorm:"type:uuid;primaryKey" json:"namespace_id"`
}

func (RoleNamespace) TableName() string {
	return "role_namespaces"
}

// AKSK stores access key pair metadata for programmatic calls.
type AKSK struct {
	ID                  string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID              string     `gorm:"type:uuid;not null;index" json:"user_id"`
	ShareExternalUserID *string    `gorm:"type:uuid;index" json:"share_external_user_id,omitempty"`
	AccessKey           string     `gorm:"type:varchar(50);not null;uniqueIndex" json:"access_key"`
	SecretKey           string     `gorm:"type:varchar(100);not null" json:"-"`
	Description         string     `gorm:"type:text" json:"description"`
	Status              AKSKStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	ExpiresAt           *time.Time `json:"expires_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	User              *User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ShareExternalUser *ShareExternalUser `gorm:"foreignKey:ShareExternalUserID" json:"share_external_user,omitempty"`
}

type AKSKStatus string

const (
	AKSKStatusActive  AKSKStatus = "active"
	AKSKStatusRevoked AKSKStatus = "revoked"
	AKSKStatusExpired AKSKStatus = "expired"
)

func (AKSK) TableName() string {
	return "ak_sks"
}
