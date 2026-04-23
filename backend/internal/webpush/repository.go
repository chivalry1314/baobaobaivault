package webpush

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Repository struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewRepository(db *gorm.DB, logger *zap.Logger) *Repository {
	return &Repository{db: db, logger: logger}
}

type UpsertSubscriptionInput struct {
	UserID   string
	DeviceID string
	AppID    string
	UA       string
	Endpoint string
	P256dh   string
	Auth     string
}

func (r *Repository) UpsertSubscription(ctx context.Context, input UpsertSubscriptionInput) (*model.WebPushSubscription, error) {
	now := time.Now().UTC()

	var existing model.WebPushSubscription
	err := r.db.WithContext(ctx).First(&existing, "endpoint = ?", input.Endpoint).Error
	if err == nil {
		existing.UserID = input.UserID
		existing.DeviceID = input.DeviceID
		existing.AppID = input.AppID
		existing.UA = input.UA
		existing.KeyP256dh = input.P256dh
		existing.KeyAuth = input.Auth
		existing.UpdatedAt = now
		if err := r.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, fmt.Errorf("update subscription: %w", err)
		}
		return &existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("query subscription: %w", err)
	}

	created := &model.WebPushSubscription{
		UserID:     input.UserID,
		DeviceID:   input.DeviceID,
		AppID:      input.AppID,
		UA:         input.UA,
		Endpoint:   input.Endpoint,
		KeyP256dh:  input.P256dh,
		KeyAuth:    input.Auth,
		FailCount:  0,
		CreatedAt:  now,
		UpdatedAt:  now,
		LastOKAt:   nil,
		LastFailAt: nil,
	}
	if err := r.db.WithContext(ctx).Create(created).Error; err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}
	return created, nil
}

func (r *Repository) ListSubscriptions(ctx context.Context) ([]model.WebPushSubscription, error) {
	var records []model.WebPushSubscription
	if err := r.db.WithContext(ctx).Order("updated_at DESC").Find(&records).Error; err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	return records, nil
}

func (r *Repository) RemoveSubscription(ctx context.Context, id, endpoint string) (int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WebPushSubscription{})
	if id != "" {
		query = query.Where("id = ?", id)
	}
	if endpoint != "" {
		query = query.Where("endpoint = ?", endpoint)
	}
	if id == "" && endpoint == "" {
		return 0, errors.New("id or endpoint is required")
	}
	result := query.Delete(&model.WebPushSubscription{})
	if result.Error != nil {
		return 0, fmt.Errorf("remove subscription: %w", result.Error)
	}
	return result.RowsAffected, nil
}

func (r *Repository) GetSubscriptionCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.WebPushSubscription{}).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count subscriptions: %w", err)
	}
	return count, nil
}

func (r *Repository) FindSubscriptionsByAudience(ctx context.Context, audience PushAudience) ([]model.WebPushSubscription, error) {
	if audience.Broadcast {
		return r.ListSubscriptions(ctx)
	}

	userIDs := normalizeStrings(audience.UserIDs)
	endpoints := normalizeStrings(audience.Endpoints)
	if len(userIDs) == 0 && len(endpoints) == 0 {
		return []model.WebPushSubscription{}, nil
	}

	var records []model.WebPushSubscription
	query := r.db.WithContext(ctx).Model(&model.WebPushSubscription{})
	if len(userIDs) > 0 && len(endpoints) > 0 {
		query = query.Where("user_id IN ? OR endpoint IN ?", userIDs, endpoints)
	} else if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	} else {
		query = query.Where("endpoint IN ?", endpoints)
	}
	if err := query.Find(&records).Error; err != nil {
		return nil, fmt.Errorf("find subscriptions: %w", err)
	}

	unique := make(map[string]model.WebPushSubscription, len(records))
	for _, record := range records {
		unique[record.Endpoint] = record
	}
	out := make([]model.WebPushSubscription, 0, len(unique))
	for _, record := range unique {
		out = append(out, record)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}

func (r *Repository) MarkPushSuccess(ctx context.Context, endpoint string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).
		Model(&model.WebPushSubscription{}).
		Where("endpoint = ?", endpoint).
		Updates(map[string]any{
			"updated_at": now,
			"last_ok_at": now,
			"fail_count": 0,
		}).Error
}

func (r *Repository) MarkPushFailure(ctx context.Context, endpoint string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).
		Model(&model.WebPushSubscription{}).
		Where("endpoint = ?", endpoint).
		Updates(map[string]any{
			"updated_at":   now,
			"last_fail_at": now,
			"fail_count":   gorm.Expr("fail_count + 1"),
		}).Error
}

type CreateEventInput struct {
	Type       string
	Audience   PushAudience
	Payload    NotificationPayload
	TTLSeconds int
}

func (r *Repository) CreateEvent(ctx context.Context, input CreateEventInput) (*model.WebPushEvent, error) {
	audienceJSON, err := json.Marshal(input.Audience)
	if err != nil {
		return nil, fmt.Errorf("marshal audience: %w", err)
	}
	payloadJSON, err := json.Marshal(input.Payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}
	now := time.Now().UTC()
	event := &model.WebPushEvent{
		Type:       input.Type,
		Audience:   datatypes.JSON(audienceJSON),
		Payload:    datatypes.JSON(payloadJSON),
		TTLSeconds: input.TTLSeconds,
		Status:     string(EventQueued),
		Summary:    nil,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := r.db.WithContext(ctx).Create(event).Error; err != nil {
		return nil, fmt.Errorf("create event: %w", err)
	}
	return event, nil
}

func (r *Repository) UpdateEventStatus(ctx context.Context, eventID string, status EventStatus, summary *DispatchSummary) (*model.WebPushEvent, error) {
	updates := map[string]any{
		"status":     string(status),
		"updated_at": time.Now().UTC(),
	}
	if summary != nil {
		summaryJSON, err := json.Marshal(summary)
		if err != nil {
			return nil, fmt.Errorf("marshal summary: %w", err)
		}
		updates["summary"] = datatypes.JSON(summaryJSON)
	}

	if err := r.db.WithContext(ctx).
		Model(&model.WebPushEvent{}).
		Where("id = ?", eventID).
		Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("update event status: %w", err)
	}
	return r.GetEvent(ctx, eventID)
}

func (r *Repository) GetEvent(ctx context.Context, eventID string) (*model.WebPushEvent, error) {
	var event model.WebPushEvent
	if err := r.db.WithContext(ctx).First(&event, "id = ?", eventID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get event: %w", err)
	}
	return &event, nil
}

func normalizeStrings(items []string) []string {
	if len(items) == 0 {
		return []string{}
	}
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	sort.Strings(out)
	return out
}
