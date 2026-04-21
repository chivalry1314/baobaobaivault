package model

import (
	"time"

	"gorm.io/gorm"
)

// StorageConfig 存储配置表（每个租户可配置多个存储后端）
type StorageConfig struct {
	ID          string              `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    string              `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Name        string              `gorm:"type:varchar(100);not null" json:"name"`
	Provider    StorageProvider     `gorm:"type:varchar(50);not null" json:"provider"`
	Endpoint    string              `gorm:"type:varchar(255)" json:"endpoint"`
	Region      string              `gorm:"type:varchar(50)" json:"region"`
	Bucket      string              `gorm:"type:varchar(100)" json:"bucket"`
	AccessKey   string              `gorm:"type:varchar(100)" json:"-"`      // 加密存储
	SecretKey   string              `gorm:"type:varchar(255)" json:"-"`      // 加密存储
	PathStyle   bool                `gorm:"default:false" json:"path_style"` // 是否使用 path-style URL
	IsDefault   bool                `gorm:"default:false" json:"is_default"`
	Status      StorageConfigStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	ExtraConfig string              `gorm:"type:text" json:"extra_config"` // JSON 格式的额外配置

	// 统计信息
	UsedStorage int64 `gorm:"default:0" json:"used_storage"`
	ObjectCount int64 `gorm:"default:0" json:"object_count"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Tenant     *Tenant     `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Namespaces []Namespace `gorm:"foreignKey:StorageConfigID" json:"namespaces,omitempty"`
}

type StorageProvider string

const (
	ProviderS3     StorageProvider = "s3"
	ProviderOSS    StorageProvider = "oss"
	ProviderCOS    StorageProvider = "cos"
	ProviderMinio  StorageProvider = "minio"
	ProviderGCS    StorageProvider = "gcs"
	ProviderAzure  StorageProvider = "azure"
	ProviderLocal  StorageProvider = "local"
	ProviderWebDAV StorageProvider = "webdav"
)

type StorageConfigStatus string

const (
	StorageConfigStatusActive   StorageConfigStatus = "active"
	StorageConfigStatusInactive StorageConfigStatus = "inactive"
	StorageConfigStatusError    StorageConfigStatus = "error"
)

func (StorageConfig) TableName() string {
	return "storage_configs"
}

// Object 对象表（文件元数据）
type Object struct {
	ID          string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	NamespaceID string `gorm:"type:uuid;not null;index" json:"namespace_id"`
	Key         string `gorm:"type:varchar(1024);not null;index:idx_object_key,namespace_id" json:"key"` // 对象路径
	Name        string `gorm:"type:varchar(255)" json:"name"`                                            // 文件名
	Size        int64  `gorm:"not null" json:"size"`
	ContentType string `gorm:"type:varchar(100)" json:"content_type"`
	ETag        string `gorm:"type:varchar(64)" json:"etag"` // MD5
	VersionID   string `gorm:"type:varchar(64)" json:"version_id"`

	// 存储信息
	StorageKey   string `gorm:"type:varchar(1024)" json:"storage_key"` // 实际存储路径
	StorageClass string `gorm:"type:varchar(20)" json:"storage_class"`

	// 元数据
	Metadata     string `gorm:"type:text" json:"metadata"`      // JSON 格式
	UserMetadata string `gorm:"type:text" json:"user_metadata"` // 用户自定义元数据

	// 版本控制
	IsLatest  bool `gorm:"default:true" json:"is_latest"`
	IsDeleted bool `gorm:"default:false" json:"is_deleted"` // 软删除标记

	// 时间戳
	LastModified time.Time      `json:"last_modified"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Namespace *Namespace      `gorm:"foreignKey:NamespaceID" json:"namespace,omitempty"`
	Versions  []ObjectVersion `gorm:"foreignKey:ObjectID" json:"versions,omitempty"`
}

func (Object) TableName() string {
	return "objects"
}

// ObjectVersion 对象版本表
type ObjectVersion struct {
	ID         string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ObjectID   string `gorm:"type:uuid;not null;index" json:"object_id"`
	VersionID  string `gorm:"type:varchar(64);not null" json:"version_id"`
	Size       int64  `gorm:"not null" json:"size"`
	ETag       string `gorm:"type:varchar(64)" json:"etag"`
	StorageKey string `gorm:"type:varchar(1024)" json:"storage_key"`
	IsLatest   bool   `gorm:"default:false" json:"is_latest"`

	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Object *Object `gorm:"foreignKey:ObjectID" json:"object,omitempty"`
}

func (ObjectVersion) TableName() string {
	return "object_versions"
}

// AuditLog 审计日志表
type AuditLog struct {
	ID         string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID   string  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	UserID     *string `gorm:"type:uuid;index" json:"user_id"`
	Action     string  `gorm:"type:varchar(50);not null;index" json:"action"`
	Resource   string  `gorm:"type:varchar(100);not null" json:"resource"`
	ResourceID string  `gorm:"type:varchar(100);index" json:"resource_id"`
	Detail     string  `gorm:"type:text" json:"detail"` // JSON 格式的详细信息
	IPAddress  string  `gorm:"type:varchar(50)" json:"ip_address"`
	UserAgent  string  `gorm:"type:varchar(500)" json:"user_agent"`
	Status     string  `gorm:"type:varchar(20)" json:"status"` // success, failed

	CreatedAt time.Time `gorm:"index" json:"created_at"`

	// 关联
	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	User   *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
