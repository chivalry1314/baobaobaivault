package model

import (
	"time"

	"gorm.io/gorm"
)

// Tenant holds tenant-level quota and ownership info.
type Tenant struct {
	ID          string       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string       `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Code        string       `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Description string       `gorm:"type:text" json:"description"`
	Status      TenantStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	Plan        TenantPlan   `gorm:"type:varchar(20);default:'free'" json:"plan"`

	// Quota
	MaxStorage     int64     `gorm:"default:10737418240" json:"max_storage"`
	MaxNamespaces  int       `gorm:"default:10" json:"max_namespaces"`
	MaxUsers       int       `gorm:"default:100" json:"max_users"`
	MaxAPICalls    int64     `gorm:"default:100000" json:"max_api_calls"`
	UsedStorage    int64     `gorm:"default:0" json:"used_storage"`
	UsedNamespaces int       `gorm:"default:0" json:"used_namespaces"`
	UsedUsers      int       `gorm:"default:0" json:"used_users"`
	UsedAPICalls   int64     `gorm:"default:0" json:"used_api_calls"`
	APICallsDate   time.Time `gorm:"type:date;not null;default:CURRENT_DATE" json:"api_calls_date"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Namespaces     []Namespace     `gorm:"foreignKey:TenantID" json:"namespaces,omitempty"`
	Users          []User          `gorm:"foreignKey:TenantID" json:"users,omitempty"`
	StorageConfigs []StorageConfig `gorm:"foreignKey:TenantID" json:"storage_configs,omitempty"`
	AKSKs          []AKSK          `gorm:"foreignKey:TenantID" json:"ak_sks,omitempty"`
}

type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "active"
	TenantStatusSuspended TenantStatus = "suspended"
	TenantStatusDeleted   TenantStatus = "deleted"
)

type TenantPlan string

const (
	TenantPlanFree       TenantPlan = "free"
	TenantPlanBasic      TenantPlan = "basic"
	TenantPlanPro        TenantPlan = "pro"
	TenantPlanEnterprise TenantPlan = "enterprise"
)

func (Tenant) TableName() string {
	return "tenants"
}

// Namespace isolates data inside a tenant.
type Namespace struct {
	ID          string   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    string   `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Name        string   `gorm:"type:varchar(100);not null;index:idx_ns_tenant_name,tenant_id" json:"name"`
	Description string   `gorm:"type:text" json:"description"`
	Status      NSStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	IsDefault   bool     `gorm:"default:false" json:"is_default"`

	StorageConfigID string `gorm:"type:uuid" json:"storage_config_id"`
	PathPrefix      string `gorm:"type:varchar(500)" json:"path_prefix"`

	MaxStorage  *int64 `json:"max_storage,omitempty"`
	MaxFiles    *int   `json:"max_files,omitempty"`
	MaxFileSize *int64 `json:"max_file_size,omitempty"`
	UsedStorage int64  `gorm:"default:0" json:"used_storage"`
	UsedFiles   int    `gorm:"default:0" json:"used_files"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant        *Tenant        `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	StorageConfig *StorageConfig `gorm:"foreignKey:StorageConfigID" json:"storage_config,omitempty"`
	Objects       []Object       `gorm:"foreignKey:NamespaceID" json:"objects,omitempty"`
	Roles         []Role         `gorm:"many2many:role_namespaces;" json:"roles,omitempty"`
}

type NSStatus string

const (
	NSStatusActive   NSStatus = "active"
	NSStatusArchived NSStatus = "archived"
)

func (Namespace) TableName() string {
	return "namespaces"
}
