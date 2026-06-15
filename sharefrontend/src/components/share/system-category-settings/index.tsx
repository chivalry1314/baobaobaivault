"use client";

import { useEffect, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareCategoryRefresh } from "@/components/share/category-provider";
import { getSlotLabel } from "@/components/share/card-editor/slot-registry";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardContentSlot, ShareCategorySettings } from "@/lib/shared";

const SLOT_TO_SETTING_KEY: Record<CardContentSlot, keyof ShareCategorySettings> = {
  system_theme: "systemThemeEnabled",
  wechat_theme: "wechatThemeEnabled",
  app: "appEnabled",
  character_persona: "characterPersonaEnabled",
  world_book: "worldBookEnabled",
  desktop_component: "desktopComponentEnabled",
};

const CATEGORY_KEYS: Array<{ key: keyof ShareCategorySettings; label: string }> =
  [
    "system_theme",
    "wechat_theme",
    "app",
    "character_persona",
    "world_book",
    "desktop_component",
  ].map((slot) => ({
    key: SLOT_TO_SETTING_KEY[slot as CardContentSlot],
    label: getSlotLabel(slot),
  }));

const DEFAULT_SETTINGS: ShareCategorySettings = {
  systemThemeEnabled: true,
  wechatThemeEnabled: true,
  appEnabled: true,
  characterPersonaEnabled: true,
  worldBookEnabled: true,
  desktopComponentEnabled: true,
};

export function ShareSystemCategorySettingsPage() {
  const { user, sessionChecking } = useShareSession();
  const refreshCategorySettings = useShareCategoryRefresh();
  const showToast = useToast();

  const [settings, setSettings] = useState<ShareCategorySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemCategorySettings();
      setSettings({ ...DEFAULT_SETTINGS, ...response.settings });
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载分类开关失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadData();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  function toggle(key: keyof ShareCategorySettings) {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSave() {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const response = await shareApi.updateSystemCategorySettings(settings);
      setSettings({ ...DEFAULT_SETTINGS, ...response.settings });
      await refreshCategorySettings();
      showToast("分类开关已保存。", "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "保存分类开关失败，请稍后重试。"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/category-settings" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/category-settings" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/category-settings" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/category-settings"
      title="分类开关"
      description="启用或禁用内容分类。关闭后，发现页将隐藏该分类标签并禁止新建对应分类卡片，已有卡片数据仍保留。"
    >
      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 border-b border-[var(--outline)]/20 pb-3">
          <h2 className="text-base font-black text-[var(--foreground)]">分类开关</h2>
          <p className="mt-1 text-xs font-bold text-[var(--foreground)]/55">
            关闭分类后，发现页不再展示该分类标签，用户也无法再创建或编辑该分类的卡片文件。
          </p>
        </div>

        {loadError ? <ErrorNotice message={loadError} /> : null}

        <div className="space-y-2">
          {CATEGORY_KEYS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-[1.1rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]/50 px-4 py-3 transition hover:bg-[var(--surface-container)]"
            >
              <div>
                <p className="text-xs font-black text-[var(--foreground)]">{label}</p>
                <p className="text-[10px] font-bold text-[var(--foreground)]/50">
                  {settings[key] ? "已启用" : "已关闭"}
                </p>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings[key] ? "bg-[var(--button-primary)]" : "bg-[var(--foreground)]/20"
                }`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={Boolean(settings[key])}
                  onChange={() => toggle(key)}
                  disabled={saving}
                />
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-[var(--button-primary)] px-5 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存分类开关"}
          </button>
        </div>
      </section>
    </SystemWorkspace>
  );
}

function SystemLoadingPage({ currentPath, text }: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 text-sm font-bold text-[var(--foreground)]/70 shadow-sm">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 shadow-sm">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="mb-3 rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">{message}</p>;
}
