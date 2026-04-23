package webpush

// PushAudience matches the MVP `mimiwebpushserver` audience format.
type PushAudience struct {
	UserIDs   []string `json:"userIds,omitempty"`
	Endpoints []string `json:"endpoints,omitempty"`
	Broadcast bool     `json:"broadcast,omitempty"`
}

type NotificationPayload struct {
	Title              string                 `json:"title"`
	Body               string                 `json:"body,omitempty"`
	Icon               string                 `json:"icon,omitempty"`
	Badge              string                 `json:"badge,omitempty"`
	Tag                string                 `json:"tag,omitempty"`
	URL                string                 `json:"url,omitempty"`
	AppID              string                 `json:"appId,omitempty"`
	RequireInteraction *bool                  `json:"requireInteraction,omitempty"`
	Params             map[string]any         `json:"params,omitempty"`
	Data               map[string]any         `json:"data,omitempty"`
}

type DispatchError struct {
	Endpoint   string `json:"endpoint"`
	StatusCode *int   `json:"statusCode,omitempty"`
	Message    string `json:"message"`
}

type DispatchSummary struct {
	Requested int             `json:"requested"`
	Sent      int             `json:"sent"`
	Failed    int             `json:"failed"`
	Removed   int             `json:"removed"`
	Errors    []DispatchError `json:"errors"`
}

type EventStatus string

const (
	EventQueued     EventStatus = "queued"
	EventProcessing EventStatus = "processing"
	EventSent       EventStatus = "sent"
	EventPartial    EventStatus = "partial"
	EventFailed     EventStatus = "failed"
)

func StatusFromSummary(summary DispatchSummary) EventStatus {
	if summary.Failed == 0 {
		return EventSent
	}
	if summary.Sent > 0 {
		return EventPartial
	}
	return EventFailed
}

