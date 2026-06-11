"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { ShareSiteBrandMark } from "@/components/share/site-brand";
import {
  ShareSiteBrandProvider,
  useShareSiteBrandControls,
} from "@/components/share/site-brand/provider";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import { shareSiteBrand } from "@/lib/site-config";
import type { ShareSiteBrandingSettings } from "@/lib/shared";

export function ShareSystemSiteBrandingPage() {
  const { user, sessionChecking } = useShareSession();
  const setGlobalBrand = useShareSiteBrandControls();
  const [settings, setSettings] = useState<ShareSiteBrandingSettings | null>(null);
  const [draft, setDraft] = useState<ShareSiteBrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [logoMessage, setLogoMessage] = useState("");
  const [logoMessageTone, setLogoMessageTone] = useState<"success" | "info">(
    "info",
  );

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [logoFile]);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemSiteBrandingSettings();
      setSettings(response.settings);
      setDraft(response.settings);
      setGlobalBrand({ ...response.settings, canUpdate: false });
    } catch (error) {
      setLoadError(
        getShareErrorMessage(error, "加载站点品牌配置失败，请稍后重试。"),
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraft<K extends keyof ShareSiteBrandingSettings>(
    key: K,
    value: ShareSiteBrandingSettings[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveMessage("");
  }

  async function syncBrandAfterMutation(
    nextSettings: ShareSiteBrandingSettings,
    successMessage: string,
    options?: {
      clearLogoFile?: boolean;
      logoSuccessMessage?: string;
    },
  ) {
    setSettings(nextSettings);
    setDraft(nextSettings);
    setGlobalBrand({ ...nextSettings, canUpdate: false });
    if (options?.clearLogoFile) {
      setLogoFile(null);
    }

    try {
      await shareApi.revalidateSiteBrandingCache();
      setSaveMessage(successMessage);
      if (options?.logoSuccessMessage) {
        setLogoMessage(options.logoSuccessMessage);
        setLogoMessageTone("success");
      }
    } catch {
      setSaveMessage(`${successMessage} 品牌缓存会在稍后自动同步。`);
      if (options?.logoSuccessMessage) {
        setLogoMessage(`${options.logoSuccessMessage} 品牌缓存会在稍后自动同步。`);
        setLogoMessageTone("info");
      }
    }
  }

  async function handleSave() {
    if (!draft || saving) {
      return;
    }

    setSaving(true);
    setSaveMessage("");
    try {
      const response = await shareApi.updateSystemSiteBrandingSettings({
        siteName: draft.siteName,
        siteShortName: draft.siteShortName,
        siteDescription: draft.siteDescription,
        siteSubtitle: draft.siteSubtitle,
        showSiteSubtitle: draft.showSiteSubtitle,
        authSubtitle: draft.authSubtitle,
        showAuthSubtitle: draft.showAuthSubtitle,
        logoText: draft.logoText,
        logoBadgeText: draft.logoBadgeText,
        logoImageSrc: draft.logoImageSrc,
        logoOriginalFileName: draft.logoOriginalFileName,
        logoMimeType: draft.logoMimeType,
        footerText: draft.footerText,
        defaultDisplayName: draft.defaultDisplayName,
        defaultCreatorName: draft.defaultCreatorName,
        defaultCreatorHandle: draft.defaultCreatorHandle,
        defaultInitials: draft.defaultInitials,
        creatorTagline: draft.creatorTagline,
      });
      await syncBrandAfterMutation(response.settings, "站点品牌配置已保存。");
    } catch (error) {
      setSaveMessage(
        getShareErrorMessage(error, "保存站点品牌配置失败，请稍后重试。"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile || uploadingLogo) {
      return;
    }

    setUploadingLogo(true);
    setLogoMessage("");
    setLogoMessageTone("info");
    try {
      const response = await shareApi.uploadSystemSiteBrandingLogo({
        file: logoFile,
        contentType: logoFile.type || undefined,
      });
      await syncBrandAfterMutation(response.settings, "站点品牌配置已同步。", {
        clearLogoFile: true,
        logoSuccessMessage: "Logo 已上传并应用到当前品牌配置。",
      });
    } catch (error) {
      setLogoMessage(getShareErrorMessage(error, "上传 Logo 失败，请稍后重试。"));
      setLogoMessageTone("info");
    } finally {
      setUploadingLogo(false);
    }
  }

  const previewBrand = useMemo<ShareSiteBrandingSettings>(() => {
    const source = draft ?? settings;
    return {
      siteName: source?.siteName || shareSiteBrand.siteName,
      siteShortName: source?.siteShortName || shareSiteBrand.siteShortName,
      siteDescription: source?.siteDescription || shareSiteBrand.siteDescription,
      siteSubtitle: source?.siteSubtitle || shareSiteBrand.siteSubtitle,
      showSiteSubtitle:
        source?.showSiteSubtitle ?? shareSiteBrand.showSiteSubtitle,
      authSubtitle: source?.authSubtitle || shareSiteBrand.authSubtitle,
      showAuthSubtitle:
        source?.showAuthSubtitle ?? shareSiteBrand.showAuthSubtitle,
      logoText: source?.logoText || shareSiteBrand.logoText,
      logoBadgeText: source?.logoBadgeText || shareSiteBrand.logoBadgeText,
      logoImageSrc:
        logoPreviewUrl || source?.logoImageSrc || shareSiteBrand.logoImageSrc,
      logoOriginalFileName: source?.logoOriginalFileName || "",
      logoMimeType: source?.logoMimeType || "",
      footerText: source?.footerText || shareSiteBrand.footerText,
      defaultDisplayName:
        source?.defaultDisplayName || shareSiteBrand.defaultDisplayName,
      defaultCreatorName:
        source?.defaultCreatorName || shareSiteBrand.defaultCreatorName,
      defaultCreatorHandle:
        source?.defaultCreatorHandle || shareSiteBrand.defaultCreatorHandle,
      defaultInitials:
        source?.defaultInitials || shareSiteBrand.defaultInitials,
      creatorTagline: source?.creatorTagline || shareSiteBrand.creatorTagline,
      canUpdate: Boolean(source?.canUpdate),
    };
  }, [draft, logoPreviewUrl, settings]);

  if (sessionChecking || loading) {
    return (
      <SystemStateView
        currentPath="/system/site-branding"
        text="正在检查系统管理权限..."
      />
    );
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/site-branding" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return (
      <SystemStateView
        currentPath="/system/site-branding"
        text="当前账号不是系统初始化超级管理员，无法访问站点品牌配置。"
      />
    );
  }

  return (
    <SystemWorkspace
      currentPath="/system/site-branding"
      title="站点品牌"
      description="在这里统一维护网站名称、说明文案、页脚以及可公开访问的品牌 Logo。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_380px]">
        <section className="space-y-5">
          <section className="dream-panel px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--foreground)]/40">
                  Brand Assets
                </p>
                <h2 className="mt-3 text-2xl font-black text-[var(--foreground)]">
                  品牌 Logo 与公开地址
                </h2>
                <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                  可以直接上传品牌 Logo，也可以继续手动填写外部图片地址。上传成功后，系统会自动切换成站内公开地址。
                </p>
              </div>
              <div className="rounded-[24px] bg-[rgba(244,249,255,0.96)] px-4 py-4 text-sm font-bold text-[#285f87] shadow-[0_18px_42px_rgba(53,89,143,0.12)]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#285f87]/75">
                  Current Logo
                </p>
                <p className="mt-2 break-all">
                  {draft?.logoOriginalFileName || "尚未上传站内 Logo"}
                </p>
                <p className="mt-1 text-xs text-[#285f87]/72">
                  {draft?.logoMimeType || "可上传 PNG / JPG / WebP / GIF / SVG"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">
                  选择 Logo 文件
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                  className="dream-input w-full px-4 py-3"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleUploadLogo()}
                disabled={!logoFile || uploadingLogo}
                className="btn-primary h-[50px] rounded-full px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingLogo ? "上传中..." : "上传并应用 Logo"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricPill
                label="预览来源"
                value={
                  logoFile
                    ? "本地待上传文件"
                    : draft?.logoImageSrc
                      ? "已保存配置"
                      : "文字 Logo"
                }
              />
              <MetricPill
                label="文件名"
                value={logoFile?.name || draft?.logoOriginalFileName || "-"}
                breakAll
              />
              <MetricPill
                label="文件大小"
                value={logoFile ? formatBytes(logoFile.size) : "-"}
              />
            </div>

            {logoMessage ? (
              <InlineNotice
                tone={logoMessageTone}
                message={logoMessage}
                className="mt-4"
              />
            ) : null}

            <div className="mt-5 rounded-[28px] border-[3px] border-[rgba(70,124,169,0.18)] bg-[linear-gradient(180deg,rgba(243,249,255,0.98),rgba(252,254,255,0.92))] px-5 py-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f628f]">
                图片地址
              </p>
              <p className="mt-2 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                如果你需要接入 CDN 或外部图床，也可以直接填写 URL。留空时会退回文字 Logo。
              </p>
              <div className="mt-4">
                <TextField
                  label="Logo 图片地址"
                  value={draft?.logoImageSrc || ""}
                  onChange={(value) => updateDraft("logoImageSrc", value)}
                />
              </div>
            </div>
          </section>

          <section className="dream-panel px-6 py-6 sm:px-8">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="站点全称"
                value={draft?.siteName || ""}
                onChange={(value) => updateDraft("siteName", value)}
              />
              <TextField
                label="站点简称"
                value={draft?.siteShortName || ""}
                onChange={(value) => updateDraft("siteShortName", value)}
              />
              <ToggleTextField
                label="站点副标题"
                toggleLabel="显示"
                checked={draft?.showSiteSubtitle ?? true}
                value={draft?.siteSubtitle || ""}
                onToggleChange={(checked) => updateDraft("showSiteSubtitle", checked)}
                onChange={(value) => updateDraft("siteSubtitle", value)}
              />
              <ToggleTextField
                label="登录页副标题"
                toggleLabel="显示"
                checked={draft?.showAuthSubtitle ?? true}
                value={draft?.authSubtitle || ""}
                onToggleChange={(checked) => updateDraft("showAuthSubtitle", checked)}
                onChange={(value) => updateDraft("authSubtitle", value)}
              />
              <TextField
                label="Logo 文字"
                value={draft?.logoText || ""}
                onChange={(value) => updateDraft("logoText", value)}
              />
              <TextField
                label="Logo 徽标"
                value={draft?.logoBadgeText || ""}
                onChange={(value) => updateDraft("logoBadgeText", value)}
              />
              <TextField
                label="页脚文案"
                value={draft?.footerText || ""}
                onChange={(value) => updateDraft("footerText", value)}
              />
              <TextField
                label="默认显示名"
                value={draft?.defaultDisplayName || ""}
                onChange={(value) => updateDraft("defaultDisplayName", value)}
              />
              <TextField
                label="默认 Creator 名称"
                value={draft?.defaultCreatorName || ""}
                onChange={(value) => updateDraft("defaultCreatorName", value)}
              />
              <TextField
                label="默认 Creator Handle"
                value={draft?.defaultCreatorHandle || ""}
                onChange={(value) => updateDraft("defaultCreatorHandle", value)}
              />
              <TextField
                label="默认首字母"
                value={draft?.defaultInitials || ""}
                onChange={(value) => updateDraft("defaultInitials", value.toUpperCase())}
              />
            </div>

            <div className="mt-4">
              <TextAreaField
                label="站点描述"
                rows={4}
                value={draft?.siteDescription || ""}
                onChange={(value) => updateDraft("siteDescription", value)}
              />
            </div>

            <div className="mt-4">
              <TextAreaField
                label="Creator 默认标语"
                rows={4}
                value={draft?.creatorTagline || ""}
                onChange={(value) => updateDraft("creatorTagline", value)}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!draft?.canUpdate || saving}
                className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存站点品牌"}
              </button>
              {saveMessage ? (
                <span className="text-sm font-bold text-[var(--foreground)]/72">
                  {saveMessage}
                </span>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <ShareSiteBrandProvider brand={previewBrand}>
            <section className="dream-panel px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/42">
                Preview
              </p>
              <div className="mt-5 rounded-[28px] border-[3px] border-[var(--outline)] bg-[rgba(248,252,255,0.92)] p-5">
                <div className="flex items-center gap-3">
                  <ShareSiteBrandMark
                    titleLevel="div"
                    iconClassName="relative flex h-14 w-14 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-[var(--outline)] bg-white text-base font-black text-[var(--foreground)]"
                    textClassName="text-2xl font-black leading-none tracking-tight text-[var(--foreground)]"
                    subtitleClassName="text-sm font-extrabold text-[var(--foreground)]/78"
                  />
                </div>
                <p className="mt-5 text-sm font-bold text-[var(--foreground)]/68">
                  {previewBrand.siteDescription}
                </p>
                <div className="mt-5 rounded-[22px] bg-white px-4 py-4">
                  <p className="text-sm font-black text-[var(--foreground)]">
                    {previewBrand.defaultCreatorName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--foreground)]/60">
                    {previewBrand.defaultCreatorHandle}
                  </p>
                  <p className="mt-3 text-sm font-bold text-[var(--foreground)]/72">
                    {previewBrand.creatorTagline}
                  </p>
                </div>
              </div>
            </section>
          </ShareSiteBrandProvider>

          <section className="dream-panel px-6 py-6">
            <h2 className="text-xl font-black text-[var(--foreground)]">说明</h2>
            <div className="mt-4 space-y-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
              <p>
                上传 Logo 后，会自动生成一个公开的站内地址，首页、登录页、卡片详情和系统页都会即时使用它。
              </p>
              <p>
                如果你填写的是外部 URL，系统会直接按该地址展示，不再依赖站内 Logo 文件。
              </p>
              <p>
                未填写图片地址时，会自动退回文字 Logo，避免站点头部出现空白。
              </p>
            </div>
          </section>
        </aside>
      </section>
    </SystemWorkspace>
  );
}

function SystemStateView(props: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace
      currentPath={props.currentPath}
      title="站点品牌"
      description={props.text}
    >
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">
        {props.text}
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

function InlineNotice(props: {
  message: string;
  tone: "success" | "info";
  className?: string;
}) {
  const toneClassName =
    props.tone === "success"
      ? "border-[#d5e8d1] bg-[#f3fbf1] text-[#2f6d37]"
      : "border-[#c9ddf4] bg-[#eef6ff] text-[#285f87]";
  return (
    <p
      className={`${props.className || ""} rounded-[22px] border px-4 py-3 text-sm font-bold ${toneClassName}`}
    >
      {props.message}
    </p>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">
        {props.label}
      </span>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="dream-input w-full px-4 py-3"
      />
    </label>
  );
}

function ToggleTextField(props: {
  label: string;
  toggleLabel: string;
  checked: boolean;
  value: string;
  onChange: (value: string) => void;
  onToggleChange: (checked: boolean) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-[var(--foreground)]/72">
        <span>{props.label}</span>
        <InlineSwitch
          label={props.toggleLabel}
          checked={props.checked}
          onChange={props.onToggleChange}
        />
      </span>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="dream-input w-full px-4 py-3"
      />
    </label>
  );
}

function InlineSwitch(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      className="inline-flex items-center gap-2 rounded-full bg-[rgba(248,252,255,0.9)] px-2.5 py-1.5 text-xs font-black text-[var(--foreground)]/72"
    >
      <span>{props.label}</span>
      <span
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full border-[2px] border-[var(--outline)] transition",
          props.checked ? "bg-[var(--button-primary)]" : "bg-white",
        ].join(" ")}
      >
        <span
          className={[
            "h-4 w-4 rounded-full border-2 border-[var(--outline)] bg-white transition",
            props.checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">
        {props.label}
      </span>
      <textarea
        rows={props.rows ?? 3}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="dream-input w-full resize-y px-4 py-3"
      />
    </label>
  );
}

function MetricPill(props: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-[22px] bg-[rgba(248,252,255,0.88)] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">
        {props.label}
      </p>
      <p
        className={`mt-1 text-sm font-black text-[var(--foreground)] ${props.breakAll ? "break-all" : ""}`}
      >
        {props.value}
      </p>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
