package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	shareCategorySettingsSingleton = "default"
)

// ShareCategorySettingsView is the API-facing representation of category toggles.
type ShareCategorySettingsView struct {
	SystemThemeEnabled      bool `json:"systemThemeEnabled"`
	WechatThemeEnabled      bool `json:"wechatThemeEnabled"`
	AppEnabled              bool `json:"appEnabled"`
	CharacterPersonaEnabled bool `json:"characterPersonaEnabled"`
	WorldBookEnabled        bool `json:"worldBookEnabled"`
	DesktopComponentEnabled bool `json:"desktopComponentEnabled"`
	CanUpdate               bool `json:"canUpdate"`
}

func defaultShareCategorySettingsView() ShareCategorySettingsView {
	return ShareCategorySettingsView{
		SystemThemeEnabled:      true,
		WechatThemeEnabled:      true,
		AppEnabled:              true,
		CharacterPersonaEnabled: true,
		WorldBookEnabled:        true,
		DesktopComponentEnabled: true,
	}
}

func categorySettingsFromModel(m *model.ShareCategorySettings) ShareCategorySettingsView {
	if m == nil {
		return defaultShareCategorySettingsView()
	}
	return ShareCategorySettingsView{
		SystemThemeEnabled:      m.SystemThemeEnabled,
		WechatThemeEnabled:      m.WechatThemeEnabled,
		AppEnabled:              m.AppEnabled,
		CharacterPersonaEnabled: m.CharacterPersonaEnabled,
		WorldBookEnabled:        m.WorldBookEnabled,
		DesktopComponentEnabled: m.DesktopComponentEnabled,
	}
}

func (s *ShareService) loadShareCategorySettingsFromDB() {
	var cfg model.ShareCategorySettings
	err := s.db.Where("singleton = ?", shareCategorySettingsSingleton).First(&cfg).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			s.logger.Warn("failed to load category settings from db", zap.Error(err))
		}
		s.setShareCategorySettings(defaultShareCategorySettingsView())
		return
	}
	s.setShareCategorySettings(categorySettingsFromModel(&cfg))
}

func (s *ShareService) getShareCategorySettings() ShareCategorySettingsView {
	s.shareCategoryCfgMu.RLock()
	defer s.shareCategoryCfgMu.RUnlock()
	return s.shareCategoryCfg
}

func (s *ShareService) setShareCategorySettings(cfg ShareCategorySettingsView) {
	s.shareCategoryCfgMu.Lock()
	defer s.shareCategoryCfgMu.Unlock()
	s.shareCategoryCfg = cfg
}

// EnabledCategorySlots returns all currently enabled content slot names.
func (s *ShareService) EnabledCategorySlots() []string {
	cfg := s.getShareCategorySettings()
	var slots []string
	if cfg.SystemThemeEnabled {
		slots = append(slots, "system_theme")
	}
	if cfg.WechatThemeEnabled {
		slots = append(slots, "wechat_theme")
	}
	if cfg.AppEnabled {
		slots = append(slots, "app")
	}
	if cfg.CharacterPersonaEnabled {
		slots = append(slots, "character_persona")
	}
	if cfg.WorldBookEnabled {
		slots = append(slots, "world_book")
	}
	if cfg.DesktopComponentEnabled {
		slots = append(slots, "desktop_component")
	}
	return slots
}

// IsCategoryEnabled reports whether a given content slot is currently enabled.
func (s *ShareService) IsCategoryEnabled(slot string) bool {
	cfg := s.getShareCategorySettings()
	switch strings.TrimSpace(slot) {
	case "system_theme":
		return cfg.SystemThemeEnabled
	case "wechat_theme":
		return cfg.WechatThemeEnabled
	case "app":
		return cfg.AppEnabled
	case "character_persona":
		return cfg.CharacterPersonaEnabled
	case "world_book":
		return cfg.WorldBookEnabled
	case "desktop_component":
		return cfg.DesktopComponentEnabled
	default:
		return false
	}
}

// GetShareCategorySettings returns the current category toggle configuration.
func (s *ShareService) GetShareCategorySettings(ctx context.Context, operatorID string) (ShareCategorySettingsView, error) {
	cfg := s.getShareCategorySettings()
	cfg.CanUpdate = s.isConfiguredShareSuperAdminUserID(ctx, operatorID)
	return cfg, nil
}

// UpdateShareCategorySettings persists new category toggles.
func (s *ShareService) UpdateShareCategorySettings(ctx context.Context, operatorID string, input ShareCategorySettingsView) (ShareCategorySettingsView, error) {
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return ShareCategorySettingsView{}, err
	}

	next := model.ShareCategorySettings{
		Singleton:               shareCategorySettingsSingleton,
		SystemThemeEnabled:      input.SystemThemeEnabled,
		WechatThemeEnabled:      input.WechatThemeEnabled,
		AppEnabled:              input.AppEnabled,
		CharacterPersonaEnabled: input.CharacterPersonaEnabled,
		WorldBookEnabled:        input.WorldBookEnabled,
		DesktopComponentEnabled: input.DesktopComponentEnabled,
		UpdatedAt:               time.Now(),
	}

	if err := s.db.WithContext(ctx).Save(&next).Error; err != nil {
		return ShareCategorySettingsView{}, err
	}

	view := categorySettingsFromModel(&next)
	view.CanUpdate = true
	s.setShareCategorySettings(view)
	s.invalidateDiscoverCache(ctx)
	return view, nil
}

