"use client";

import { useEffect, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  ShareMediaStorageMigrationPlan,
  ShareMediaStorageMigrationRunResult,
  ShareMediaStorageSettings,
  ShareNamespace,
} from "@/lib/shared";

type MediaStorageTab = "settings" | "migration";

export function ShareSystemMediaStoragePage() {
  const { user, sessionChecking } = useShareSession();
  const [activeTab, setActiveTab] = useState<MediaStorageTab>("settings");
  const [settings, setSettings] = useState<ShareMediaStorageSettings | null>(null);
  const [draft, setDraft] = useState<ShareMediaStorageSettings | null>(null);
  const [migration, setMigration] = useState<ShareMediaStorageMigrationPlan | null>(null);
  const [namespaces, setNamespaces] = useState<ShareNamespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [migrationMessage, setMigrationMessage] = useState("");
  const [migrationResult, setMigrationResult] = useState<ShareMediaStorageMigrationRunResult | null>(null);
  const [migrationBatchSize, setMigrationBatchSize] = useState("20");
  const [deleteLocalAfterMigration, setDeleteLocalAfterMigration] = useState(false);
  const [includeMissingFiles, setIncludeMissingFiles] = useState(false);

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
      setMigration(settingsResponse.migration);
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
      setMigration(response.migration);
      setMessage("媒体存储设置已保存。");
    } catch (error) {
      setMessage(getShareErrorMessage(error, "保存媒体存储设置失败，请稍后重试。"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunMigration() {
    if (migrating) {
      return;
    }

    const batchSize = Number.parseInt(migrationBatchSize, 10);
    if (!Number.isFinite(batchSize) || batchSize <= 0) {
      setMigrationMessage("迁移批次大小必须是大于 0 的整数。");
      return;
    }

    setMigrating(true);
    setMigrationMessage("");
    setMigrationResult(null);
    try {
      const response = await shareApi.runSystemMediaStorageMigration({
        batchSize,
        deleteLocal: deleteLocalAfterMigration,
        includeMissing: includeMissingFiles,
      });
      setSettings(response.settings);
      setDraft(response.settings);
      setMigration(response.migration);
      setMigrationResult(response.result);
      setMigrationMessage(
        response.result.failed > 0
          ? "迁移已执行，部分文件失败，请检查下方结果。"
          : "迁移已执行完成。"
      );
    } catch (error) {
      setMigrationMessage(getShareErrorMessage(error, "执行历史文件迁移失败，请稍后重试。"));
    } finally {
      setMigrating(false);
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
      description="把开关配置和历史迁移拆开管理，让切换对象存储和迁移历史文件都更清楚。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <section className="space-y-5">
          <section className="dream-panel overflow-hidden px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--foreground)]/40">
                  Share Media Control
                </p>
                <h2 className="mt-3 text-2xl font-black text-[var(--foreground)]">媒体存储控制台</h2>
                <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                  这里分成两个工作区：一个负责决定新文件怎么写入，另一个负责把历史本地文件逐步搬到 OSS。
                </p>
              </div>
              <div className="rounded-[24px] bg-[rgba(250,245,247,0.94)] px-4 py-4 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                <p>当前写入模式：{settings?.storageMode === "object_storage" ? "对象存储 / OSS" : "本地存储"}</p>
                <p>本地回退读取：{settings?.localFallbackEnabled ? "已开启" : "已关闭"}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <HighlightCard
                label="待迁移历史文件"
                value={`${migration?.summary.totalPending ?? 0}`}
                hint="仍保存在本地，尚未搬到 OSS"
              />
              <HighlightCard
                label="缺失本地文件"
                value={`${migration?.summary.totalMissing ?? 0}`}
                hint="数据库里有记录，但本地文件已不存在"
              />
              <HighlightCard
                label="封面命名空间"
                value={
                  namespaces.find((item) => item.id === settings?.coverNamespaceID)?.name ||
                  settings?.coverNamespaceID ||
                  "未配置"
                }
                hint="卡片封面会写入这里"
                compact
              />
              <HighlightCard
                label="附件命名空间"
                value={
                  namespaces.find((item) => item.id === settings?.assetNamespaceID)?.name ||
                  settings?.assetNamespaceID ||
                  "未配置"
                }
                hint="卡片附件会写入这里"
                compact
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <TabButton
                active={activeTab === "settings"}
                label="存储开关配置"
                description="调整新上传文件的写入方式"
                onClick={() => setActiveTab("settings")}
              />
              <TabButton
                active={activeTab === "migration"}
                label="历史文件迁移"
                description="分批迁移旧的本地媒体文件"
                onClick={() => setActiveTab("migration")}
              />
            </div>
          </section>

          {activeTab === "settings" ? (
            <section className="dream-panel px-6 py-6 sm:px-8">
              <SectionHeader
                eyebrow="Storage Settings"
                title="新文件写入配置"
                description="这里的开关只影响后续新上传的卡片封面和附件，历史文件不会因为切换而失效。"
              />

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

              <div className="mt-6 rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                推荐先准备好对象存储配置和命名空间，再切换到对象存储模式，并先保留本地回退读取开启。
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
          ) : (
            <section className="dream-panel px-6 py-6 sm:px-8">
              <SectionHeader
                eyebrow="Migration"
                title="历史本地文件迁移"
                description="建议按小批次逐步执行，先确认 OSS 访问链路稳定，再决定是否删除本地副本。"
              />

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <MetricCard label="待迁移封面" value={`${migration?.summary.coversPending ?? 0} 个`} />
                <MetricCard label="待迁移附件" value={`${migration?.summary.assetsPending ?? 0} 个`} />
                <MetricCard label="缺失封面" value={`${migration?.summary.coversMissing ?? 0} 个`} />
                <MetricCard label="缺失附件" value={`${migration?.summary.assetsMissing ?? 0} 个`} />
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-[28px] border border-[rgba(220,173,187,0.34)] bg-[rgba(255,252,250,0.96)] px-5 py-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">单次迁移数量</span>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={migrationBatchSize}
                        onChange={(event) => setMigrationBatchSize(event.target.value)}
                        disabled={migrating || !migration?.canMigrate}
                        className="dream-input w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>

                    <div className="rounded-[22px] bg-white/75 px-4 py-4 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                      <p>适合先用 10 到 20 条做验证。</p>
                      <p>单批太大时，接口执行时间会更长。</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <ToggleField
                      label="迁移成功后删除本地文件"
                      checked={deleteLocalAfterMigration}
                      disabled={migrating || !migration?.canMigrate}
                      onChange={setDeleteLocalAfterMigration}
                    />

                    <ToggleField
                      label="结果中显示缺失的本地文件"
                      checked={includeMissingFiles}
                      disabled={migrating || !migration?.canMigrate}
                      onChange={setIncludeMissingFiles}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleRunMigration()}
                      disabled={
                        migrating ||
                        !migration?.canMigrate ||
                        settings?.storageMode !== "object_storage" ||
                        (migration?.summary.totalPending ?? 0) <= 0
                      }
                      className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {migrating ? "迁移中..." : "执行一批历史文件迁移"}
                    </button>
                    {migrationMessage ? (
                      <span className="text-sm font-bold text-[var(--foreground)]/72">{migrationMessage}</span>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-[28px] bg-[rgba(248,252,255,0.92)] px-5 py-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">
                    Safety Notes
                  </p>
                  <div className="mt-3 space-y-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                    <p>1. 先确认对象存储模式和命名空间都已经配置完成。</p>
                    <p>2. 初次迁移建议不要勾选删除本地文件。</p>
                    <p>3. 迁移后抽查详情页、下载页、封面预览是否正常。</p>
                    <p>4. 缺失文件不会自动补回，只会在结果中提示你排查。</p>
                  </div>
                </section>
              </div>

              {migrationResult ? (
                <section className="mt-6 rounded-[28px] border border-[rgba(220,173,187,0.34)] bg-[rgba(255,251,245,0.94)] px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">
                        Latest Run
                      </p>
                      <h3 className="mt-2 text-lg font-black text-[var(--foreground)]">最近一次迁移结果</h3>
                    </div>
                    <p className="text-sm font-bold text-[var(--foreground)]/68">
                      {migrationResult.hasMore ? "仍有待迁移文件，可继续执行下一批。" : "当前没有更多待迁移历史文件。"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="已处理" value={`${migrationResult.processed} 个`} />
                    <MetricCard label="成功" value={`${migrationResult.succeeded} 个`} />
                    <MetricCard label="跳过" value={`${migrationResult.skipped} 个`} />
                    <MetricCard label="失败" value={`${migrationResult.failed} 个`} />
                  </div>

                  {migrationResult.messages.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      {migrationResult.messages.map((item, index) => (
                        <p
                          key={`${index}-${item}`}
                          className="rounded-[18px] bg-white/85 px-3 py-2 text-xs font-bold leading-6 text-[var(--foreground)]/70"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </section>
          )}
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
            <h2 className="text-xl font-black text-[var(--foreground)]">操作建议</h2>
            <div className="mt-4 space-y-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
              <p>1. 先在“存储配置”和“命名空间”里准备好对象存储。</p>
              <p>2. 在“存储开关配置”中把新文件写入切到 OSS。</p>
              <p>3. 在“历史文件迁移”里按批次迁移旧文件。</p>
              <p>4. 验证稳定后，再决定是否清理本地副本。</p>
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

function SectionHeader(props: { eyebrow: string; title: string; description: string }) {
  const { eyebrow, title, description } = props;
  return (
    <div className="border-b border-[rgba(220,173,187,0.35)] pb-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--foreground)]/40">{eyebrow}</p>
      <h2 className="mt-3 text-xl font-black text-[var(--foreground)]">{title}</h2>
      <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">{description}</p>
    </div>
  );
}

function HighlightCard(props: { label: string; value: string; hint: string; compact?: boolean }) {
  const { label, value, hint, compact = false } = props;
  return (
    <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,255,0.92))] px-4 py-4 shadow-[0_18px_48px_rgba(188,148,164,0.12)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/42">{label}</p>
      <p className={`mt-3 font-black text-[var(--foreground)] ${compact ? "break-all text-sm" : "text-2xl"}`}>{value}</p>
      <p className="mt-2 text-xs font-bold leading-6 text-[var(--foreground)]/58">{hint}</p>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  const { active, label, description, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-[220px] cursor-pointer rounded-[24px] border px-5 py-4 text-left transition-colors duration-200",
        active
          ? "border-[rgba(202,122,147,0.36)] bg-[rgba(255,245,248,0.96)] shadow-[0_18px_42px_rgba(197,133,156,0.16)]"
          : "border-[rgba(220,173,187,0.26)] bg-white/78 hover:bg-[rgba(248,252,255,0.88)]",
      ].join(" ")}
    >
      <p className="text-sm font-black text-[var(--foreground)]">{label}</p>
      <p className="mt-2 text-xs font-bold leading-6 text-[var(--foreground)]/62">{description}</p>
    </button>
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
    <label className="dream-panel-soft flex cursor-pointer items-center justify-between rounded-[24px] px-4 py-4 text-sm font-black text-[var(--foreground)]">
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
