export const UI_SETTINGS_KEY = "bv_ui_settings";

export const defaultUiSettings = {
  compactNav: false,
  enableAutoRefresh: false,
  refreshMinutes: 5,
};

export function normalizeUiSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const minutes = Number(source.refreshMinutes);
  return {
    compactNav: Boolean(source.compactNav),
    enableAutoRefresh: Boolean(source.enableAutoRefresh),
    refreshMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.trunc(minutes) : defaultUiSettings.refreshMinutes,
  };
}

export function readUiSettings() {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return defaultUiSettings;
    return normalizeUiSettings(JSON.parse(raw));
  } catch {
    return defaultUiSettings;
  }
}

export function saveUiSettings(value) {
  const payload = normalizeUiSettings(value);
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(payload));
  return payload;
}
