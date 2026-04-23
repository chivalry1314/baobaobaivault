package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	webpushsvc "github.com/baobaobai/baobaobaivault/internal/webpush"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (h *Handler) registerWebPushPublicRoutes(api *gin.RouterGroup) {
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"ok":      true,
			"service": "baobaobaivault-webpush",
			"now":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	api.GET("/push/vapid-public-key", h.webPushVapidPublicKey)
	api.POST("/push/subscriptions", h.webPushUpsertSubscription)
	api.DELETE("/push/subscriptions", h.webPushDeleteSubscription)
	api.GET("/push/subscriptions", h.webPushListSubscriptions)
	api.POST("/push/test", h.webPushTest)
	api.POST("/push/dispatch", h.webPushDispatch)
	api.GET("/push/events/:eventId", h.webPushGetEvent)
	api.GET("/push/queue", h.webPushQueueStatus)
}

func (h *Handler) webPushVapidPublicKey(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"publicKey": strings.TrimSpace(h.cfg.WebPush.VAPIDPublicKey),
	})
}

func (h *Handler) webPushUpsertSubscription(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}

	body := map[string]any{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}

	candidate := body["subscription"]
	if candidate == nil {
		candidate = body
	}
	subscription, ok := parseSubscriptionPayload(candidate)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid subscription payload"})
		return
	}

	userID := nonEmptyString(body["userId"])
	if userID == "" {
		userID = nonEmptyString(c.GetHeader("x-user-id"))
	}
	if userID == "" {
		userID = "anonymous"
	}

	deviceID := nonEmptyString(body["deviceId"])
	appID := nonEmptyString(body["appId"])
	ua := strings.TrimSpace(c.GetHeader("User-Agent"))

	saved, err := h.webPushRepo.UpsertSubscription(c.Request.Context(), webpushsvc.UpsertSubscriptionInput{
		UserID:   userID,
		DeviceID: deviceID,
		AppID:    appID,
		UA:       ua,
		Endpoint: subscription.Endpoint,
		P256dh:   subscription.Keys.P256dh,
		Auth:     subscription.Keys.Auth,
	})
	if err != nil {
		h.logger.Error("webpush upsert subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"ok":             true,
		"subscriptionId": saved.ID,
		"userId":         saved.UserID,
		"endpoint":       saved.Endpoint,
		"updatedAt":      saved.UpdatedAt.Format(time.RFC3339),
	})
}

func (h *Handler) webPushDeleteSubscription(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}

	body := map[string]any{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}
	endpoint := nonEmptyString(body["endpoint"])
	id := nonEmptyString(body["id"])
	if endpoint == "" && id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "id or endpoint is required"})
		return
	}

	removed, err := h.webPushRepo.RemoveSubscription(c.Request.Context(), id, endpoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"removed": removed,
	})
}

func (h *Handler) webPushListSubscriptions(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}
	if !h.ensureDispatchAuth(c) {
		return
	}

	records, err := h.webPushRepo.ListSubscriptions(c.Request.Context())
	if err != nil {
		h.logger.Error("webpush list subscriptions failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	subscriptions := make([]gin.H, 0, len(records))
	for _, record := range records {
		subscriptions = append(subscriptions, gin.H{
			"id":        record.ID,
			"userId":    record.UserID,
			"deviceId":  emptyToNil(record.DeviceID),
			"appId":     emptyToNil(record.AppID),
			"ua":        emptyToNil(record.UA),
			"endpoint":  record.Endpoint,
			"keys":      gin.H{"p256dh": record.KeyP256dh, "auth": record.KeyAuth},
			"createdAt": record.CreatedAt.Format(time.RFC3339),
			"updatedAt": record.UpdatedAt.Format(time.RFC3339),
			"failCount": record.FailCount,
			"lastSuccessAt": timePtrToRFC3339(record.LastOKAt),
			"lastFailureAt": timePtrToRFC3339(record.LastFailAt),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":            true,
		"total":         len(records),
		"subscriptions": subscriptions,
	})
}

func (h *Handler) webPushTest(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}

	body := map[string]any{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}

	endpoint := nonEmptyString(body["endpoint"])
	userID := nonEmptyString(body["userId"])
	if userID == "" {
		userID = nonEmptyString(c.GetHeader("x-user-id"))
	}

	audience := webpushsvc.PushAudience{}
	if endpoint != "" {
		audience.Endpoints = []string{endpoint}
	} else if userID != "" {
		audience.UserIDs = []string{userID}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "endpoint or userId (or x-user-id header) is required"})
		return
	}

	payload, err := sanitizePayload(body, &webpushsvc.NotificationPayload{
		Title: "Baobaobai Vault 测试通知",
		Body:  "Web Push 通道可用",
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ttlSeconds := positiveInt(body["ttlSeconds"])
	if ttlSeconds <= 0 {
		ttlSeconds = h.cfg.WebPush.DefaultTTLSeconds
	}

	event, err := h.webPushRepo.CreateEvent(c.Request.Context(), webpushsvc.CreateEventInput{
		Type:       "test",
		Audience:   audience,
		Payload:    payload,
		TTLSeconds: ttlSeconds,
	})
	if err != nil {
		h.logger.Error("webpush create test event failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	h.enqueueWebPushDispatch(event.ID)
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "eventId": event.ID, "status": event.Status})
}

func (h *Handler) webPushDispatch(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}
	if !h.ensureDispatchAuth(c) {
		return
	}

	body := map[string]any{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid json"})
		return
	}

	eventType := nonEmptyString(body["type"])
	if eventType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "type is required"})
		return
	}

	audience := sanitizeAudience(body["audience"])
	hasAudience := audience.Broadcast || len(audience.UserIDs) > 0 || len(audience.Endpoints) > 0
	if !hasAudience {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "audience is required: set broadcast=true or provide userIds/endpoints"})
		return
	}

	payload, err := sanitizePayload(body, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}

	ttlSeconds := positiveInt(body["ttlSeconds"])
	if ttlSeconds <= 0 {
		ttlSeconds = h.cfg.WebPush.DefaultTTLSeconds
	}

	event, err := h.webPushRepo.CreateEvent(c.Request.Context(), webpushsvc.CreateEventInput{
		Type:       eventType,
		Audience:   audience,
		Payload:    payload,
		TTLSeconds: ttlSeconds,
	})
	if err != nil {
		h.logger.Error("webpush create dispatch event failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	h.enqueueWebPushDispatch(event.ID)
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "eventId": event.ID, "status": event.Status})
}

func (h *Handler) webPushGetEvent(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}
	if !h.ensureDispatchAuth(c) {
		return
	}

	eventID := strings.TrimSpace(c.Param("eventId"))
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "eventId is required"})
		return
	}

	event, err := h.webPushRepo.GetEvent(c.Request.Context(), eventID)
	if err != nil {
		h.logger.Error("webpush get event failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}
	if event == nil {
		c.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "event not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "event": event})
}

func (h *Handler) webPushQueueStatus(c *gin.Context) {
	if !h.webPushReady(c) {
		return
	}
	if !h.ensureDispatchAuth(c) {
		return
	}

	totalSubscriptions, err := h.webPushRepo.GetSubscriptionCount(c.Request.Context())
	if err != nil {
		h.logger.Error("webpush count subscriptions failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":                true,
		"queue":             h.webPushQueue.Snapshot(),
		"totalSubscriptions": totalSubscriptions,
	})
}

func (h *Handler) enqueueWebPushDispatch(eventID string) {
	if h.webPushQueue == nil {
		return
	}
	err := h.webPushQueue.Enqueue(func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		_, _ = h.webPushRepo.UpdateEventStatus(ctx, eventID, webpushsvc.EventProcessing, nil)

		event, err := h.webPushRepo.GetEvent(ctx, eventID)
		if err != nil {
			h.logger.Error("webpush load event failed", zap.Error(err), zap.String("eventId", eventID))
			return err
		}
		if event == nil {
			h.logger.Warn("webpush skipped unknown event", zap.String("eventId", eventID))
			return nil
		}

		var audience webpushsvc.PushAudience
		_ = json.Unmarshal(event.Audience, &audience)

		var payload webpushsvc.NotificationPayload
		_ = json.Unmarshal(event.Payload, &payload)

		subscriptions, err := h.webPushRepo.FindSubscriptionsByAudience(ctx, audience)
		if err != nil {
			h.logger.Error("webpush find subscriptions failed", zap.Error(err), zap.String("eventId", eventID))
			return err
		}
		if len(subscriptions) == 0 {
			summary := webpushsvc.DispatchSummary{
				Requested: 0,
				Sent:      0,
				Failed:    0,
				Removed:   0,
				Errors:    []webpushsvc.DispatchError{{Endpoint: "", Message: "No subscriptions matched audience"}},
			}
			_, _ = h.webPushRepo.UpdateEventStatus(ctx, eventID, webpushsvc.EventFailed, &summary)
			h.logger.Warn("webpush no subscriptions matched audience", zap.String("eventId", eventID))
			return nil
		}

		summary, sendErr := h.webPushService.SendToSubscriptions(ctx, subscriptions, payload, event.ID, event.TTLSeconds)
		if sendErr != nil {
			h.logger.Error("webpush send failed", zap.Error(sendErr), zap.String("eventId", eventID))
			failedSummary := webpushsvc.DispatchSummary{
				Requested: 0,
				Sent:      0,
				Failed:    1,
				Removed:   0,
				Errors:    []webpushsvc.DispatchError{{Endpoint: "", Message: sendErr.Error()}},
			}
			_, _ = h.webPushRepo.UpdateEventStatus(ctx, eventID, webpushsvc.EventFailed, &failedSummary)
			return sendErr
		}

		status := webpushsvc.StatusFromSummary(summary)
		_, _ = h.webPushRepo.UpdateEventStatus(ctx, event.ID, status, &summary)
		h.logger.Info("webpush event dispatched",
			zap.String("eventId", event.ID),
			zap.Int("requested", summary.Requested),
			zap.Int("sent", summary.Sent),
			zap.Int("failed", summary.Failed),
		)
		return nil
	})

	if err == nil {
		return
	}

	h.logger.Warn("webpush enqueue failed", zap.Error(err), zap.String("eventId", eventID))
	summary := webpushsvc.DispatchSummary{
		Requested: 0,
		Sent:      0,
		Failed:    1,
		Removed:   0,
		Errors:    []webpushsvc.DispatchError{{Endpoint: "", Message: err.Error()}},
	}
	_, _ = h.webPushRepo.UpdateEventStatus(context.Background(), eventID, webpushsvc.EventFailed, &summary)
}

func (h *Handler) webPushReady(c *gin.Context) bool {
	if !h.cfg.WebPush.Enabled || h.webPushRepo == nil || h.webPushQueue == nil || h.webPushService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "error": "webpush is disabled"})
		return false
	}
	return true
}

func (h *Handler) ensureDispatchAuth(c *gin.Context) bool {
	key := strings.TrimSpace(h.cfg.WebPush.DispatchAPIKey)
	if key == "" {
		return true
	}

	headerKey := strings.TrimSpace(c.GetHeader("x-dispatch-key"))
	if headerKey != "" && headerKey == key {
		return true
	}

	authorization := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
		token := strings.TrimSpace(authorization[len("bearer "):])
		if token == key {
			return true
		}
	}

	c.JSON(http.StatusUnauthorized, gin.H{"ok": false, "error": "unauthorized"})
	return false
}

type subscriptionKeys struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type subscriptionPayload struct {
	Endpoint string          `json:"endpoint"`
	Keys     subscriptionKeys `json:"keys"`
}

func parseSubscriptionPayload(value any) (subscriptionPayload, bool) {
	record, ok := value.(map[string]any)
	if !ok || record == nil {
		return subscriptionPayload{}, false
	}
	endpoint := nonEmptyString(record["endpoint"])
	keysRecord, ok := record["keys"].(map[string]any)
	if endpoint == "" || !ok {
		return subscriptionPayload{}, false
	}
	p256dh := nonEmptyString(keysRecord["p256dh"])
	auth := nonEmptyString(keysRecord["auth"])
	if p256dh == "" || auth == "" {
		return subscriptionPayload{}, false
	}
	return subscriptionPayload{
		Endpoint: endpoint,
		Keys: subscriptionKeys{
			P256dh: p256dh,
			Auth:   auth,
		},
	}, true
}

func sanitizeAudience(value any) webpushsvc.PushAudience {
	record, ok := value.(map[string]any)
	if !ok || record == nil {
		return webpushsvc.PushAudience{}
	}
	out := webpushsvc.PushAudience{
		UserIDs:   toStringSlice(record["userIds"]),
		Endpoints: toStringSlice(record["endpoints"]),
	}
	if b, ok := record["broadcast"].(bool); ok {
		out.Broadcast = b
	}
	return out
}

func sanitizePayload(body map[string]any, defaults *webpushsvc.NotificationPayload) (webpushsvc.NotificationPayload, error) {
	title := nonEmptyString(body["title"])
	if title == "" && defaults != nil {
		title = defaults.Title
	}
	if title == "" {
		return webpushsvc.NotificationPayload{}, errors.New("title is required")
	}

	payload := webpushsvc.NotificationPayload{
		Title: title,
		Body:  nonEmptyString(body["body"]),
		Icon:  nonEmptyString(body["icon"]),
		Badge: nonEmptyString(body["badge"]),
		Tag:   nonEmptyString(body["tag"]),
		URL:   nonEmptyString(body["url"]),
		AppID: nonEmptyString(body["appId"]),
	}
	if defaults != nil {
		if payload.Body == "" {
			payload.Body = defaults.Body
		}
		if payload.Icon == "" {
			payload.Icon = defaults.Icon
		}
		if payload.Badge == "" {
			payload.Badge = defaults.Badge
		}
		if payload.Tag == "" {
			payload.Tag = defaults.Tag
		}
		if payload.URL == "" {
			payload.URL = defaults.URL
		}
		if payload.AppID == "" {
			payload.AppID = defaults.AppID
		}
		if payload.Params == nil {
			payload.Params = defaults.Params
		}
		if payload.Data == nil {
			payload.Data = defaults.Data
		}
		if payload.RequireInteraction == nil {
			payload.RequireInteraction = defaults.RequireInteraction
		}
	}

	if b, ok := body["requireInteraction"].(bool); ok {
		payload.RequireInteraction = &b
	}
	if params, ok := body["params"].(map[string]any); ok {
		payload.Params = params
	}
	if data, ok := body["data"].(map[string]any); ok {
		payload.Data = data
	}

	return payload, nil
}

func nonEmptyString(value any) string {
	s, ok := value.(string)
	if !ok {
		return ""
	}
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return ""
	}
	return trimmed
}

func positiveInt(value any) int {
	switch v := value.(type) {
	case float64:
		if v <= 0 {
			return 0
		}
		return int(v)
	case int:
		if v <= 0 {
			return 0
		}
		return v
	default:
		return 0
	}
}

func toStringSlice(value any) []string {
	arr, ok := value.([]any)
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			trimmed := strings.TrimSpace(s)
			if trimmed != "" {
				out = append(out, trimmed)
			}
		}
	}
	return out
}

func emptyToNil(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func timePtrToRFC3339(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.UTC().Format(time.RFC3339)
}
