"use client";

import { useEffect, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareMediaStorageSettings, ShareNamespace } from "@/lib/shared";

export function ShareSystemMediaStoragePage() {
  const { user, sessionChecking } = useShareSession();
  const [settings, setSettings] = useState<ShareMediaStorageSettings | null>(null);
  const [draft, setDraft] = useState<ShareMediaStorageSettings | null>(null);
  const [namespaces, setNamespaces] = useState<ShareNamespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [settingsResponse, namespaceResponse] = await Promise.all([
        shareApi.systemMediaStorageSettings(),
        shareApi.systemNamespaces({ page: 1, pageSize: 100 }),
      ]);
      setSettings(settingsResponse.settings);
      setDraft(settingsResponse.settings);
      setNamespaces(namespaceResponse.items || []);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载媒体存储设置失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(patch: Partial<ShareMediaStorageSettings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setMessage("");
  }

  async function handleSave() {
    if (!draft || saving) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await shareApi.updateSystemMediaStorageSettings({
        storageMode: draft.storageMode,
        localFallbackEnabled: draft.localFallbackEnabled,
        coverNamespaceID: draft.coverNamespaceID,
        assetNamespaceID: draft.assetNamespaceID,
      });
      setSettings(response.settings);
      setDraft(response.settings);
      setMessage("媒体存储设置已保存。");
    } catch (error) {
      setMessage(getShareErrorMessage(error, "保存媒体存储设置失败，请稍后重试。"));
    } finally {
      setSaving(false);
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/media-storage" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/media-storage" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/media-storage" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/media-storage"
      title="媒体存储"
      description="控制卡片封面和附件的新上传文件写入本地还是对象存储，并绑定对应命名空间。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="dream-panel px-6 py-6 sm:px-8">
          <div className="border-b border-[rgba(220,173,187,0.35)] pb-5">
            <h2 className="text-xl font-black text-[var(--foreground)]">存储开关</h2>
            <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
              这里的开关只影响后续新上传的卡片封面和附件。历史文件仍按自身记录的存储位置读取，不会因为切换开关而失效。
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SelectField
              label="新文件存储方式"
              value={draft?.storageMode || "local"}
              disabled={!draft?.canUpdate || saving}
              options={[
                { label: "本地存储", value: "local" },
                { label: "对象存储 / OSS", value: "object_storage" },
              ]}
              onChange={(value) =>
                updateDraft({
                  storageMode: value as "local" | "object_storage",
                })
              }
            />

            <ToggleField
              label="旧本地文件回退读取"
              checked={draft?.localFallbackEnabled ?? true}
              disabled={!draft?.canUpdate || saving}
              onChange={(checked) =>
                updateDraft({
                  localFallbackEnabled: checked,
                })
              }
            />

            <SelectField
              label="封面命名空间"
              value={draft?.coverNamespaceID || ""}
              disabled={!draft?.canUpdate || saving || draft?.storageMode !== "object_storage"}
              options={[
                { label: "请选择命名空间", value: "" },
                ...namespaces.map((item) => ({ label: item.name, value: item.id })),
              ]}
              onChange={(value) => updateDraft({ coverNamespaceID: value })}
            />

            <SelectField
              label="附件命名空间"
              value={draft?.assetNamespaceID || ""}
              disabled={!draft?.canUpdate || saving || draft?.storageMode !== "object_storage"}
              options={[
                { label: "请选择命名空间", value: "" },
                ...namespaces.map((item) => ({ label: item.name, value: item.id })),
              ]}
              onChange={(value) => updateDraft({ assetNamespaceID: value })}
            />
          </div>

          <div className="mt-6 rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/60">
            推荐做法是先保持“旧本地文件回退读取”为开启，切换到对象存储后让新卡片先稳定运行一段时间，再考虑迁移历史本地文件。
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!draft?.canUpdate || saving}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存媒体存储设置"}
            </button>
            {message ? (
              <span className="text-sm font-bold text-[var(--foreground)]/72">{message}</span>
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <section className="dream-panel px-6 py-6">
            <h2 className="text-xl font-black text-[var(--foreground)]">当前状态</h2>
            <div className="mt-5 grid gap-3">
              <MetricCard
                label="当前写入模式"
                value={settings?.storageMode === "object_storage" ? "对象存储 / OSS" : "本地存储"}
              />
              <MetricCard
                label="本地回退"
                value={settings?.localFallbackEnabled ? "已开启" : "已关闭"}
              />
              <MetricCard
                label="封面命名空间"
                value={
                  namespaces.find((item) => item.id === settings?.coverNamespaceID)?.name ||
                  settings?.coverNamespaceID ||
                  "未配置"
                }
                breakAll
              />
              <MetricCard
                label="附件命名空间"
                value={
                  namespaces.find((item) => item.id === settings?.assetNamespaceID)?.name ||
                  settings?.assetNamespaceID ||
                  "未配置"
                }
                breakAll
              />
            </div>
          </section>

          <section className="dream-panel px-6 py-6">
            <h2 className="text-xl font-black text-[var(--foreground)]">切换建议</h2>
            <div className="mt-4 space-y-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
              <p>1. 先在“存储配置”和“命名空间”里准备好对象存储配置与对应命名空间。</p>
              <p>2. 再把这里切换到“对象存储 / OSS”，并保留本地回退开启。</p>
              <p>3. 等新上传卡片稳定运行后，再决定是否迁移历史本地文件。</p>
            </div>
          </section>
        </section>
      </section>
    </SystemWorkspace>
  );
}

function SystemLoadingPage({ currentPath, text }: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace
      currentPath={currentPath}
      title="系统管理"
      description="当前账号不是系统初始化超级管理员，无法访问此页面。"
    >
      <div className="dream-panel px-6 py-8">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">
          当前账号不是系统初始化超级管理员，无法访问此页面。
        </p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">
      {message}
    </p>
  );
}

function MetricCard(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-[22px] bg-[rgba(248,252,255,0.88)] px-4 py-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">{label}</p>
      <p className={`mt-2 text-sm font-black text-[var(--foreground)] ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  disabled: boolean;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const { label, value, disabled, options, onChange } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="dream-input w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { label, checked, disabled, onChange } = props;
  return (
    <label className="dream-panel-soft flex items-center justify-between rounded-[24px] px-4 py-4 text-sm font-black text-[var(--foreground)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 disabled:cursor-not-allowed"
      />
    </label>
  );
}
