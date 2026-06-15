package service

import (
	"context"
	"io"

	"github.com/baobaobai/baobaobaivault/internal/model"
)

func init() {
	defaultSlotRegistry.Register(&systemThemeSlotHandler{})
	defaultSlotRegistry.Register(&wechatThemeSlotHandler{})
	defaultSlotRegistry.Register(&desktopComponentSlotHandler{})
	defaultSlotRegistry.Register(&worldBookSlotHandler{})
	defaultSlotRegistry.Register(&characterPersonaSlotHandler{})
	defaultSlotRegistry.Register(&appSlotHandler{})
}

type systemThemeSlotHandler struct{}

func (h *systemThemeSlotHandler) Slot() string   { return "system_theme" }
func (h *systemThemeSlotHandler) Label() string  { return "系统主题" }
func (h *systemThemeSlotHandler) Enabled() bool  { return true }
func (h *systemThemeSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	_, err := validateAndCloneShareSystemThemeReader(fileName, reader)
	return err
}
func (h *systemThemeSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	view, err := s.loadCardSystemThemeView(ctx, card, []model.SharePlatformCardAsset{*asset})
	if err != nil || view == nil {
		return nil, err
	}
	return *view, nil
}
func (h *systemThemeSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	items, total, err := s.ListDiscoverSystemThemes(ctx, page, size)
	if err != nil {
		return nil, 0, err
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out, total, nil
}

type wechatThemeSlotHandler struct{}

func (h *wechatThemeSlotHandler) Slot() string   { return "wechat_theme" }
func (h *wechatThemeSlotHandler) Label() string  { return "微信主题" }
func (h *wechatThemeSlotHandler) Enabled() bool  { return true }
func (h *wechatThemeSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	_, err := validateAndCloneShareWechatThemeReader(fileName, reader)
	return err
}
func (h *wechatThemeSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	view, err := s.loadCardWechatThemeView(ctx, card, []model.SharePlatformCardAsset{*asset})
	if err != nil || view == nil {
		return nil, err
	}
	return *view, nil
}
func (h *wechatThemeSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	items, total, err := s.ListDiscoverWechatThemes(ctx, page, size)
	if err != nil {
		return nil, 0, err
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out, total, nil
}

type desktopComponentSlotHandler struct{}

func (h *desktopComponentSlotHandler) Slot() string   { return "desktop_component" }
func (h *desktopComponentSlotHandler) Label() string  { return "桌面组件" }
func (h *desktopComponentSlotHandler) Enabled() bool  { return true }
func (h *desktopComponentSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	_, err := validateAndCloneShareDesktopComponentReader(fileName, reader)
	return err
}
func (h *desktopComponentSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	view, err := s.loadCardDesktopComponentView(ctx, card, []model.SharePlatformCardAsset{*asset})
	if err != nil || view == nil {
		return nil, err
	}
	return *view, nil
}
func (h *desktopComponentSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	items, total, err := s.ListDiscoverDesktopComponents(ctx, page, size)
	if err != nil {
		return nil, 0, err
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out, total, nil
}

type worldBookSlotHandler struct{}

func (h *worldBookSlotHandler) Slot() string   { return "world_book" }
func (h *worldBookSlotHandler) Label() string  { return "世界书" }
func (h *worldBookSlotHandler) Enabled() bool  { return true }
func (h *worldBookSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	_, err := validateAndCloneShareWorldBookReader(fileName, reader)
	return err
}
func (h *worldBookSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	view, err := s.loadCardWorldBookView(ctx, card, []model.SharePlatformCardAsset{*asset})
	if err != nil || view == nil {
		return nil, err
	}
	return *view, nil
}
func (h *worldBookSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	items, total, err := s.ListDiscoverWorldBooks(ctx, page, size)
	if err != nil {
		return nil, 0, err
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out, total, nil
}

type characterPersonaSlotHandler struct{}

func (h *characterPersonaSlotHandler) Slot() string   { return "character_persona" }
func (h *characterPersonaSlotHandler) Label() string  { return "角色人设" }
func (h *characterPersonaSlotHandler) Enabled() bool  { return true }
func (h *characterPersonaSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	_, err := validateAndCloneShareCharacterPersonaReader(fileName, reader)
	return err
}
func (h *characterPersonaSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	view, err := s.loadCardCharacterPersonaView(ctx, card, []model.SharePlatformCardAsset{*asset})
	if err != nil || view == nil {
		return nil, err
	}
	return *view, nil
}
func (h *characterPersonaSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	items, total, err := s.ListDiscoverCharacterPersonas(ctx, page, size)
	if err != nil {
		return nil, 0, err
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out, total, nil
}

type appSlotHandler struct{}

func (h *appSlotHandler) Slot() string   { return "app" }
func (h *appSlotHandler) Label() string  { return "App" }
func (h *appSlotHandler) Enabled() bool  { return false }
func (h *appSlotHandler) Validate(reader io.Reader, fileName string, mimeType string) error {
	return ErrSlotNotImplemented
}
func (h *appSlotHandler) BuildView(ctx context.Context, s *ShareService, card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (any, error) {
	return nil, ErrSlotNotImplemented
}
func (h *appSlotHandler) ListDiscover(ctx context.Context, s *ShareService, page, size int) ([]any, int64, error) {
	return []any{}, 0, nil
}
