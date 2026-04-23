package webpush

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/model"
	webpush "github.com/SherClockHolmes/webpush-go"
	"go.uber.org/zap"
)

type ServiceOptions struct {
	VAPIDSubject    string
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	DefaultTTL      int
	PushProxyURL    string
}

type Service struct {
	options    ServiceOptions
	repository *Repository
	logger     *zap.Logger
}

func NewService(options ServiceOptions, repository *Repository, logger *zap.Logger) *Service {
	if options.DefaultTTL <= 0 {
		options.DefaultTTL = 300
	}
	return &Service{
		options:    options,
		repository: repository,
		logger:     logger,
	}
}

func (s *Service) SendToSubscriptions(
	ctx context.Context,
	subscriptions []model.WebPushSubscription,
	payload NotificationPayload,
	eventID string,
	ttlSeconds int,
) (DispatchSummary, error) {
	if ttlSeconds <= 0 {
		ttlSeconds = s.options.DefaultTTL
	}

	envelope := buildPushEnvelope(payload, eventID)
	body, err := json.Marshal(envelope)
	if err != nil {
		return DispatchSummary{}, fmt.Errorf("marshal push body: %w", err)
	}

	summary := DispatchSummary{
		Requested: len(subscriptions),
		Sent:      0,
		Failed:    0,
		Removed:   0,
		Errors:    []DispatchError{},
	}

	for _, subscription := range subscriptions {
		statusCode, sendErr := s.sendOne(ctx, subscription, body, ttlSeconds)
		if sendErr == nil {
			summary.Sent += 1
			_ = s.repository.MarkPushSuccess(ctx, subscription.Endpoint)
			continue
		}

		summary.Failed += 1
		_ = s.repository.MarkPushFailure(ctx, subscription.Endpoint)
		summary.Errors = append(summary.Errors, DispatchError{
			Endpoint:   subscription.Endpoint,
			StatusCode: statusCode,
			Message:    sendErr.Error(),
		})

		if statusCode != nil && (*statusCode == http.StatusNotFound || *statusCode == http.StatusGone) {
			removed, removeErr := s.repository.RemoveSubscription(ctx, "", subscription.Endpoint)
			if removeErr != nil {
				s.logger.Warn("failed to remove expired subscription", zap.Error(removeErr), zap.String("endpoint", subscription.Endpoint))
			} else if removed > 0 {
				summary.Removed += int(removed)
			}
		}
	}

	return summary, nil
}

func (s *Service) sendOne(ctx context.Context, subscription model.WebPushSubscription, body []byte, ttlSeconds int) (*int, error) {
	if s.options.PushProxyURL != "" {
		s.logger.Warn("webpush pushProxyUrl is configured but not implemented in Go backend yet", zap.String("pushProxyUrl", s.options.PushProxyURL))
	}

	sub := &webpush.Subscription{
		Endpoint: subscription.Endpoint,
		Keys: webpush.Keys{
			Auth:   subscription.KeyAuth,
			P256dh: subscription.KeyP256dh,
		},
	}
	options := &webpush.Options{
		Subscriber:      s.options.VAPIDSubject,
		VAPIDPublicKey:  s.options.VAPIDPublicKey,
		VAPIDPrivateKey: s.options.VAPIDPrivateKey,
		TTL:             ttlSeconds,
	}

	resp, err := webpush.SendNotificationWithContext(ctx, body, sub, options)
	if resp != nil && resp.Body != nil {
		defer resp.Body.Close()
	}
	if err == nil {
		return nil, nil
	}

	var statusCode *int
	if resp != nil {
		sc := resp.StatusCode
		statusCode = &sc
	}

	message := strings.TrimSpace(err.Error())
	if resp != nil && resp.Body != nil {
		if raw, readErr := io.ReadAll(io.LimitReader(resp.Body, 1024)); readErr == nil {
			bodyText := strings.TrimSpace(string(raw))
			if bodyText != "" {
				message = message + ": " + bodyText
			}
		}
	}
	return statusCode, fmt.Errorf("%s", message)
}

type pushEnvelope struct {
	Title              string         `json:"title"`
	Body               string         `json:"body"`
	Icon               string         `json:"icon,omitempty"`
	Badge              string         `json:"badge,omitempty"`
	Tag                string         `json:"tag,omitempty"`
	RequireInteraction *bool          `json:"requireInteraction,omitempty"`
	Data               map[string]any `json:"data"`
}

func buildPushEnvelope(payload NotificationPayload, eventID string) pushEnvelope {
	customData := map[string]any{}
	for k, v := range payload.Data {
		customData[k] = v
	}

	data := map[string]any{
		"eventId": eventID,
	}
	if payload.URL != "" {
		data["url"] = payload.URL
	}
	if payload.AppID != "" {
		data["appId"] = payload.AppID
	}
	if payload.Params != nil {
		data["params"] = payload.Params
	}
	for k, v := range customData {
		data[k] = v
	}

	return pushEnvelope{
		Title:              payload.Title,
		Body:               payload.Body,
		Icon:               payload.Icon,
		Badge:              payload.Badge,
		Tag:                payload.Tag,
		RequireInteraction: payload.RequireInteraction,
		Data:               data,
	}
}

