package service

import (
	"context"
	"errors"
	"io"
	"sync"

	"github.com/baobaobai/baobaobaivault/internal/model"
)

// ShareSlotHandler is the plugin interface for each card content slot.
// Implementations are registered in a ShareSlotRegistry and are used to
// validate uploads, build detail views, and serve discover lists.
type ShareSlotHandler interface {
	// Slot returns the canonical slot name, e.g. "wechat_theme".
	Slot() string

	// Label returns a human-readable label for the slot.
	Label() string

	// Enabled reports whether this slot is implemented. A slot can be
	// registered but still disabled (e.g. "app" is currently a placeholder).
	Enabled() bool

	// Validate checks whether the uploaded reader conforms to the slot protocol.
	Validate(reader io.Reader, fileName string, mimeType string) error

	// BuildView builds the slot-specific view for a card detail response.
	// The returned value must be JSON-serializable.
	BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error)

	// ListDiscover returns a paginated list of discover items for this slot.
	ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error)
}

// ErrSlotNotImplemented is returned when a registered slot has no runtime implementation.
var ErrSlotNotImplemented = errors.New("slot is registered but not implemented")

// ShareSlotRegistry holds all registered slot handlers.
type ShareSlotRegistry struct {
	mu       sync.RWMutex
	handlers map[string]ShareSlotHandler
}

// NewShareSlotRegistry creates an empty registry.
func NewShareSlotRegistry() *ShareSlotRegistry {
	return &ShareSlotRegistry{
		handlers: make(map[string]ShareSlotHandler),
	}
}

// defaultSlotRegistry is the process-wide registry used by ShareService.
var defaultSlotRegistry = NewShareSlotRegistry()

// Register adds a handler to the registry. It panics if the slot is already registered.
func (r *ShareSlotRegistry) Register(h ShareSlotHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if h == nil {
		panic("cannot register nil ShareSlotHandler")
	}

	slot := h.Slot()
	if _, exists := r.handlers[slot]; exists {
		panic("duplicate slot registration: " + slot)
	}
	r.handlers[slot] = h
}

// Get returns the handler for the given slot, if any.
func (r *ShareSlotRegistry) Get(slot string) (ShareSlotHandler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	h, ok := r.handlers[slot]
	return h, ok
}

// Slots returns all registered slot names in a stable order.
func (r *ShareSlotRegistry) Slots() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	slots := make([]string, 0, len(r.handlers))
	for slot := range r.handlers {
		slots = append(slots, slot)
	}
	return slots
}
