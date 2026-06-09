package model

import (
	"time"

	"gorm.io/gorm"
)

// Namespace isolates object data and can optionally be scoped to one owner.
type Namespace struct {
	ID          string   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OwnerUserID *string  `gorm:"type:uuid;index" json:"owner_user_id,omitempty"`
	Name        string   `gorm:"type:varchar(100);not null;uniqueIndex:idx_namespace_name" json:"name"`
	Description string   `gorm:"type:text" json:"description"`
	Status      NSStatus `gorm:"type:varchar(20);default:'active'" json:"status"`
	IsDefault   bool     `gorm:"default:false" json:"is_default"`

	StorageConfigID *string `gorm:"type:uuid" json:"storage_config_id,omitempty"`
	PathPrefix      string  `gorm:"type:varchar(500)" json:"path_prefix"`

	MaxStorage  *int64 `json:"max_storage,omitempty"`
	MaxFiles    *int   `json:"max_files,omitempty"`
	MaxFileSize *int64 `json:"max_file_size,omitempty"`
	UsedStorage int64  `gorm:"default:0" json:"used_storage"`
	UsedFiles   int    `gorm:"default:0" json:"used_files"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Owner         *ShareExternalUser `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	StorageConfig *StorageConfig     `gorm:"foreignKey:StorageConfigID" json:"storage_config,omitempty"`
	Objects       []Object           `gorm:"foreignKey:NamespaceID" json:"objects,omitempty"`
	Roles         []Role             `gorm:"many2many:role_namespaces;" json:"roles,omitempty"`
}

type NSStatus string

const (
	NSStatusActive   NSStatus = "active"
	NSStatusArchived NSStatus = "archived"
)

func (Namespace) TableName() string {
	return "namespaces"
}
