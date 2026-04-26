package model

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User 用户表
type User struct {
	ID       string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID string     `gorm:"type:uuid;not null;index;uniqueIndex:idx_user_tenant_username,priority:1" json:"tenant_id"`
	Username string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_user_tenant_username,priority:2" json:"username"`
	Email    string     `gorm:"type:varchar(100);not null;index:idx_user_tenant_email,tenant_id" json:"email"`
	Password string     `gorm:"type:varchar(255);not null" json:"-"`
	Nickname string     `gorm:"type:varchar(100)" json:"nickname"`
	Avatar   string     `gorm:"type:varchar(500)" json:"avatar"`
	Status   UserStatus `gorm:"type:varchar(20);default:'active'" json:"status"`

	// 时间戳
	LastLoginAt *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Tenant    *Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
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
	RoleCodeTenantAdmin   = "tenant_admin"
	RoleCodePlatformAdmin = "platform_admin"
)

func (User) TableName() string {
	return "users"
}

// SetPassword 设置密码（加密）
func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword 验证密码
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// Role 角色表
type Role struct {
	ID          string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    *string `gorm:"type:uuid;index" json:"tenant_id"` // nil 表示系统内置角色
	Code        string  `gorm:"type:varchar(50);not null;uniqueIndex:idx_role_code,tenant_id" json:"code"`
	Name        string  `gorm:"type:varchar(100);not null" json:"name"`
	Description string  `gorm:"type:text" json:"description"`
	IsSystem    bool    `gorm:"default:false" json:"is_system"` // 是否系统内置角色
	Level       int     `gorm:"default:0" json:"level"`         // 角色层级，越大权限越高

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 关联
	Tenant      *Tenant      `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Permissions []Permission `gorm:"many2many:role_permissions;" json:"permissions,omitempty"`
	Users       []User       `gorm:"many2many:user_roles;" json:"users,omitempty"`
	Namespaces  []Namespace  `gorm:"many2many:role_namespaces;" json:"namespaces,omitempty"`
}

func (Role) TableName() string {
	return "roles"
}

// Permission 权限表
type Permission struct {
	ID          string           `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Code        string           `gorm:"type:varchar(100);not null;uniqueIndex" json:"code"`
	Name        string           `gorm:"type:varchar(100);not null" json:"name"`
	Description string           `gorm:"type:text" json:"description"`
	Resource    string           `gorm:"type:varchar(100);not null" json:"resource"` // 资源类型: tenant, user, namespace, object
	Action      PermissionAction `gorm:"type:varchar(20);not null" json:"action"`    // 操作类型: create, read, update, delete, list

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 关联
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

// AKSK AccessKey/SecretKey 表
type AKSK struct {
	ID          string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    string     `gorm:"type:uuid;not null;index" json:"tenant_id"`
	UserID      string     `gorm:"type:uuid;not null;index" json:"user_id"`
	AccessKey   string     `gorm:"type:varchar(50);not null;uniqueIndex" json:"access_key"`
	SecretKey   string     `gorm:"type:varchar(100);not null" json:"-"` // 加密存储，不返回给前端
	Description string     `gorm:"type:text" json:"description"`
	Status      AKSKStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	User   *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
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
