"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { shareApi } from "@/lib/share-api";
import type { CardContentSlot, ShareCategorySettings } from "@/lib/shared";

const defaultCategorySettings: ShareCategorySettings = {
  systemThemeEnabled: true,
  wechatThemeEnabled: true,
  appEnabled: true,
  characterPersonaEnabled: true,
  worldBookEnabled: true,
  desktopComponentEnabled: true,
};

function normalizeSlot(slot: string): CardContentSlot | "" {
  switch (slot) {
    case "system_theme":
    case "wechat_theme":
    case "app":
    case "character_persona":
    case "world_book":
    case "desktop_component":
      return slot;
    default:
      return "";
  }
}

export function isCategoryEnabled(
  settings: ShareCategorySettings | null | undefined,
  slot: CardContentSlot | string,
): boolean {
  if (!settings) {
    return true;
  }
  const normalized = normalizeSlot(slot);
  switch (normalized) {
    case "system_theme":
      return settings.systemThemeEnabled;
    case "wechat_theme":
      return settings.wechatThemeEnabled;
    case "app":
      return settings.appEnabled;
    case "character_persona":
      return settings.characterPersonaEnabled;
    case "world_book":
      return settings.worldBookEnabled;
    case "desktop_component":
      return settings.desktopComponentEnabled;
    default:
      return true;
  }
}

type ShareCategoryContextValue = {
  settings: ShareCategorySettings;
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (slot: CardContentSlot | string) => boolean;
};

const ShareCategoryContext = createContext<ShareCategoryContextValue>({
  settings: defaultCategorySettings,
  loading: false,
  refresh: async () => {},
  isEnabled: () => true,
});

export function ShareCategoryProvider(props: {
  initialSettings?: ShareCategorySettings | null;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<ShareCategorySettings>(
    props.initialSettings ?? defaultCategorySettings,
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await shareApi.publicCategorySettings();
      if (response?.settings) {
        setSettings({ ...defaultCategorySettings, ...response.settings });
      }
    } catch {
      // Ignore: keep the existing settings as fallback.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isEnabled = useCallback(
    (slot: CardContentSlot | string) => isCategoryEnabled(settings, slot),
    [settings],
  );

  const value = useMemo(
    () => ({ settings, loading, refresh, isEnabled }),
    [settings, loading, refresh, isEnabled],
  );

  return (
    <ShareCategoryContext.Provider value={value}>
      {props.children}
    </ShareCategoryContext.Provider>
  );
}

export function useShareCategorySettings() {
  return useContext(ShareCategoryContext).settings;
}

export function useShareCategoryLoading() {
  return useContext(ShareCategoryContext).loading;
}

export function useShareCategoryRefresh() {
  return useContext(ShareCategoryContext).refresh;
}

export function useShareCategoryEnabled(slot: CardContentSlot | string) {
  return useContext(ShareCategoryContext).isEnabled(slot);
}

export function useShareCategoryContext() {
  return useContext(ShareCategoryContext);
}
