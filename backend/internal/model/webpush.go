package model

import (
	"time"

	"gorm.io/datatypes"
)

// WebPushSubscription stores a browser/device push subscription (endpoint + keys).
// This model is designed to be compatible with the standalone `mimiwebpushserver` MVP backend.
type WebPushSubscription struct {
	ID       string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID   string `gorm:"type:varchar(100);index;not null" json:"userId"`
	DeviceID string `gorm:"type:varchar(100)" json:"deviceId,omitempty"`
	AppID    string `gorm:"type:varchar(100)" json:"appId,omitempty"`
	UA       string `gorm:"type:text" json:"ua,omitempty"`

	Endpoint   string `gorm:"type:text;uniqueIndex;not null" json:"endpoint"`
	KeyP256dh  string `gorm:"type:text;not null" json:"-"`
	KeyAuth    string `gorm:"type:text;not null" json:"-"`
	FailCount  int    `gorm:"default:0" json:"failCount"`
	LastOKAt   *time.Time `json:"lastSuccessAt,omitempty"`
	LastFailAt *time.Time `json:"lastFailureAt,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (WebPushSubscription) TableName() string {
	return "webpush_subscriptions"
}

type WebPushEvent struct {
	ID         string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Type       string         `gorm:"type:varchar(100);not null;index" json:"type"`
	Audience   datatypes.JSON `gorm:"type:jsonb;not null" json:"audience"`
	Payload    datatypes.JSON `gorm:"type:jsonb;not null" json:"payload"`
	TTLSeconds int            `gorm:"not null" json:"ttlSeconds"`
	Status     string         `gorm:"type:varchar(20);not null;index" json:"status"`
	Summary    datatypes.JSON `gorm:"type:jsonb" json:"summary,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (WebPushEvent) TableName() string {
	return "webpush_events"
}

