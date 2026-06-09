package model

import (
	"time"

	"gorm.io/gorm"
)

// StorageConfig describes one storage backend configuration.
type StorageConfig struct {
	ID          string              `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OwnerUserID *string             `gorm:"type:uuid;index" json:"owner_user_id,omitempty"`
	Name        string              `gorm:"type:varchar(100);not null" json:"name"`
	Provider    StorageProvider     `gorm:"type:varchar(50);not null" json:"provider"`
	Endpoint    string              `gorm:"type:varchar(255)" json:"endpoint"`
	Region      string              `gorm:"type:varchar(50)" json:"region"`
	Bucket      string              `gorm:"type:varchar(100)" json:"bucket"`
	AccessKey   string              `gorm:"type:varchar(100)" json:"-"`
	SecretKey   string              `gorm:"type:varchar(255)" json:"-"`
	PathStyle   bool                `gorm:"default:false" json:"path_style"`
	IsDefault   bool                `gorm:"default:false" json:"is_default"`
	Status      StorageConfigStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	ExtraConfig string              `gorm:"type:text" json:"extra_config"`
	UsedStorage int64               `gorm:"default:0" json:"used_storage"`
	ObjectCount int64               `gorm:"default:0" json:"object_count"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Owner      *ShareExternalUser `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	Namespaces []Namespace       `gorm:"foreignKey:StorageConfigID" json:"namespaces,omitempty"`
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

// Object stores metadata for the latest live version of one object key.
type Object struct {
	ID          string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	NamespaceID string `gorm:"type:uuid;not null;index" json:"namespace_id"`
	Key         string `gorm:"type:varchar(1024);not null;index:idx_object_key,namespace_id" json:"key"`
	Name        string `gorm:"type:varchar(255)" json:"name"`
	Size        int64  `gorm:"not null" json:"size"`
	ContentType string `gorm:"type:varchar(100)" json:"content_type"`
	ETag        string `gorm:"type:varchar(64)" json:"etag"`
	VersionID   string `gorm:"type:varchar(64)" json:"version_id"`

	StorageKey   string `gorm:"type:varchar(1024)" json:"storage_key"`
	StorageClass string `gorm:"type:varchar(20)" json:"storage_class"`
	Metadata     string `gorm:"type:text" json:"metadata"`
	UserMetadata string `gorm:"type:text" json:"user_metadata"`

	IsLatest  bool `gorm:"default:true" json:"is_latest"`
	IsDeleted bool `gorm:"default:false" json:"is_deleted"`

	LastModified time.Time      `json:"last_modified"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Namespace *Namespace      `gorm:"foreignKey:NamespaceID" json:"namespace,omitempty"`
	Versions  []ObjectVersion `gorm:"foreignKey:ObjectID" json:"versions,omitempty"`
}

func (Object) TableName() string {
	return "objects"
}

// ObjectVersion stores historical immutable object versions.
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

	Object *Object `gorm:"foreignKey:ObjectID" json:"object,omitempty"`
}

func (ObjectVersion) TableName() string {
	return "object_versions"
}

// AuditLog records management operation traces.
type AuditLog struct {
	ID         string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     *string `gorm:"type:uuid;index" json:"user_id"`
	Action     string  `gorm:"type:varchar(50);not null;index" json:"action"`
	Resource   string  `gorm:"type:varchar(100);not null" json:"resource"`
	ResourceID string  `gorm:"type:varchar(100);index" json:"resource_id"`
	Detail     string  `gorm:"type:text" json:"detail"`
	IPAddress  string  `gorm:"type:varchar(50)" json:"ip_address"`
	UserAgent  string  `gorm:"type:varchar(500)" json:"user_agent"`
	Status     string  `gorm:"type:varchar(20)" json:"status"`

	CreatedAt time.Time `gorm:"index" json:"created_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
