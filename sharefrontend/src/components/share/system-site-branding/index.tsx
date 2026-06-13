"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { ShareSiteBrandMark } from "@/components/share/site-brand";
import {
  ShareSiteBrandProvider,
  useShareSiteBrandControls,
} from "@/components/share/site-brand/provider";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import { shareSiteBrand } from "@/lib/site-config";
import type { ShareSiteBrandingSettings } from "@/lib/shared";

export function ShareSystemSiteBrandingPage() {
  const { user, sessionChecking } = useShareSession();
  const setGlobalBrand = useShareSiteBrandControls();
  const [settings, setSettings] = useState<ShareSiteBrandingSettings | null>(null);
  const [draft, setDraft] = useState<ShareSiteBrandingSettings | null>(null);
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const showToast = useToast();

  const loadData = useCallback(async () => {
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
  }, [setGlobalBrand]);

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadData();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin, loadData]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [logoFile]);

  function updateDraft<K extends keyof ShareSiteBrandingSettings>(
    key: K,
    value: ShareSiteBrandingSettings[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
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
      showToast(successMessage, "success");
      if (options?.logoSuccessMessage) {
        showToast(options.logoSuccessMessage, "success");
      }
    } catch {
      showToast(`${successMessage} 品牌缓存会在稍后自动同步。`, "info");
      if (options?.logoSuccessMessage) {
        showToast(`${options.logoSuccessMessage} 品牌缓存会在稍后自动同步。`, "info");
      }
    }
  }

  async function handleSave() {
    if (!draft || saving) {
      return;
    }

    setSaving(true);
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
      showToast(
        getShareErrorMessage(error, "保存站点品牌配置失败，请稍后重试。"),
        "error",
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
      showToast(getShareErrorMessage(error, "上传 Logo 失败，请稍后重试。"), "error");
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_340px]">
        <section className="space-y-4">
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--outline)]/20 pb-3">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/40">
                  Brand Assets
                </p>
                <h2 className="mt-1 text-lg font-black text-[var(--foreground)]">
                  品牌 Logo 与公开地址
                </h2>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--foreground)]/60">
                  可以直接上传品牌 Logo，也可以继续手动填写外部图片地址。上传成功后，系统会自动切换成站内公开地址。
                </p>
              </div>
              <div className="rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)]/70">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/45">
                  Current Logo
                </p>
                <p className="mt-1 max-w-[200px] break-all">
                  {draft?.logoOriginalFileName || "尚未上传站内 Logo"}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--foreground)]/50">
                  {draft?.logoMimeType || "可上传 PNG / JPG / WebP / GIF / SVG"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">
                  选择 Logo 文件
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                  className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-black"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleUploadLogo()}
                disabled={!logoFile || uploadingLogo}
                className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingLogo ? "上传中..." : "上传并应用 Logo"}
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
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

            <div className="mt-3 rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/45">
                图片地址
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--foreground)]/60">
                如果你需要接入 CDN 或外部图床，也可以直接填写 URL。留空时会退回文字 Logo。
              </p>
              <div className="mt-2">
                <TextField
                  label="Logo 图片地址"
                  value={draft?.logoImageSrc || ""}
                  onChange={(value) => updateDraft("logoImageSrc", value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <div className="border-b border-[var(--outline)]/20 pb-3">
              <h2 className="text-base font-black text-[var(--foreground)]">站点文案与默认值</h2>
              <p className="mt-0.5 text-xs font-bold text-[var(--foreground)]/60">按用途分组管理站点名称、页面文案、Logo 文案和默认创作者信息。</p>
            </div>

            <div className="mt-3 space-y-3">
              <section>
                <h3 className="text-xs font-black text-[var(--foreground)]/75">站点信息</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                  <div className="md:col-span-2">
                    <TextAreaField
                      label="站点描述"
                      rows={2}
                      value={draft?.siteDescription || ""}
                      onChange={(value) => updateDraft("siteDescription", value)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-[var(--foreground)]/75">页面文案</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                  <div className="md:col-span-2">
                    <TextField
                      label="页脚文案"
                      value={draft?.footerText || ""}
                      onChange={(value) => updateDraft("footerText", value)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-[var(--foreground)]/75">Logo 文案</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-[var(--foreground)]/75">默认创作者信息</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                  <div className="md:col-span-2">
                    <TextAreaField
                      label="Creator 默认标语"
                      rows={2}
                      value={draft?.creatorTagline || ""}
                      onChange={(value) => updateDraft("creatorTagline", value)}
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!draft?.canUpdate || saving}
                className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存站点品牌"}
              </button>
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <ShareSiteBrandProvider brand={previewBrand}>
            <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/40">
                Preview
              </p>
              <div className="mt-2 rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
                <div className="flex items-center gap-3">
                  <ShareSiteBrandMark
                    titleLevel="div"
                    iconClassName="relative flex h-12 w-12 -rotate-6 items-center justify-center rounded-xl border-2 border-[var(--outline)] bg-white text-sm font-black text-[var(--foreground)]"
                    textClassName="text-xl font-black leading-none tracking-tight text-[var(--foreground)]"
                    subtitleClassName="text-xs font-extrabold text-[var(--foreground)]/78"
                  />
                </div>
                <p className="mt-3 text-xs font-bold text-[var(--foreground)]/65">
                  {previewBrand.siteDescription}
                </p>
                <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/20 bg-white px-3 py-2.5">
                  <p className="text-xs font-black text-[var(--foreground)]">
                    {previewBrand.defaultCreatorName}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
                    {previewBrand.defaultCreatorHandle}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-[var(--foreground)]/65">
                    {previewBrand.creatorTagline}
                  </p>
                </div>
              </div>
            </section>
          </ShareSiteBrandProvider>

          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-black text-[var(--foreground)]">说明</h2>
            <div className="mt-2 space-y-1.5 text-xs font-bold leading-5 text-[var(--foreground)]/60">
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
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 text-sm font-bold text-[var(--foreground)]/70 shadow-sm">
        {props.text}
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <p className="rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">
      {message}
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
      <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">
        {props.label}
      </span>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
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
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-black text-[var(--foreground)]/65">
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
        className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
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
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1 text-[10px] font-black text-[var(--foreground)]/72"
    >
      <span>{props.label}</span>
      <span
        className={[
          "relative inline-flex h-4 w-7 items-center rounded-full border border-[var(--outline)] transition",
          props.checked ? "bg-[var(--button-primary)]" : "bg-white",
        ].join(" ")}
      >
        <span
          className={[
            "h-2.5 w-2.5 rounded-full border border-[var(--outline)] bg-white transition",
            props.checked ? "translate-x-3" : "translate-x-0.5",
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
      <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">
        {props.label}
      </span>
      <textarea
        rows={props.rows ?? 3}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full resize-y rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
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
    <div className="rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/40">
        {props.label}
      </p>
      <p
        className={`mt-0.5 text-xs font-black text-[var(--foreground)] ${props.breakAll ? "break-all" : ""}`}
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
