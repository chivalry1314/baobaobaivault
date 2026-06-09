"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { SystemBackLink } from "@/components/share/system-back-link";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareStorageConfig } from "@/lib/shared";

const PAGE_SIZE = 10;

type StorageFormState = {
  name: string;
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  pathStyle: boolean;
  isDefault: boolean;
  extraConfig: string;
};

const emptyStorageForm: StorageFormState = {
  name: "",
  provider: "local",
  endpoint: "",
  region: "",
  bucket: "",
  accessKey: "",
  secretKey: "",
  pathStyle: false,
  isDefault: true,
  extraConfig: "",
};

export function ShareSystemStoragePage() {
  const { user, sessionChecking } = useShareSession();
  const [items, setItems] = useState<ShareStorageConfig[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadStorageConfigs();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length]);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  async function loadStorageConfigs() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemStorageConfigs();
      setItems(response.items || []);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载存储配置失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确认删除这条存储配置吗？");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setActionError("");
    setSuccessMessage("");
    try {
      await shareApi.deleteSystemStorageConfig(id);
      setSuccessMessage("存储配置已删除。");
      await loadStorageConfigs();
    } catch (error) {
      setActionError(getShareErrorMessage(error, "删除存储配置失败，请稍后重试。"));
    } finally {
      setDeletingId("");
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/storage" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/storage" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/storage" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/storage"
      title="存储配置"
      description="统一管理本地、阿里云 OSS、S3、MinIO 等对象存储配置。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">现有配置</h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              第 {safePage} / {totalPages} 页，共 {items.length} 条配置
            </p>
          </div>
          <Link
            href="/system/storage/new"
            className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black"
          >
            新增配置
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
              <p>暂时还没有存储配置。</p>
              <Link href="/system/storage/new" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                去创建第一条配置
              </Link>
            </div>
          ) : (
            pagedItems.map((item) => (
              <article key={item.id} className="dream-panel-soft rounded-[22px] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-[var(--foreground)]">{item.name}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                        {item.provider.toUpperCase()}
                      </span>
                      {item.is_default ? (
                        <span className="rounded-full bg-[rgba(199,244,214,0.9)] px-3 py-1 text-xs font-black text-[#2f6d37]">
                          默认
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 break-all text-sm font-bold text-[var(--foreground)]/68">Bucket: {item.bucket || "-"}</p>
                    <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]/68">Endpoint: {item.endpoint || "-"}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">Region: {item.region || "-"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/system/storage/${encodeURIComponent(item.id)}/edit`}
                      className="btn-subtle inline-flex rounded-full px-4 py-3 text-sm font-black text-[var(--foreground)]/76"
                    >
                      修改
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="rounded-full bg-[#c94c3b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
          className="mt-6"
        />
      </section>
    </SystemWorkspace>
  );
}

export function ShareSystemStorageCreatePage() {
  return <ShareSystemStorageFormPage mode="create" />;
}

export function ShareSystemStorageEditPage(props: { storageConfigID: string }) {
  return <ShareSystemStorageFormPage mode="edit" storageConfigID={props.storageConfigID} />;
}

function ShareSystemStorageFormPage(props: { mode: "create" | "edit"; storageConfigID?: string }) {
  const { mode, storageConfigID = "" } = props;
  const { user, sessionChecking } = useShareSession();
  const [form, setForm] = useState<StorageFormState>(emptyStorageForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (mode !== "edit" || !user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadCurrentConfig();
  }, [mode, storageConfigID, user?.id, user?.isConfiguredSuperAdmin]);

  async function loadCurrentConfig() {
    setLoading(true);
    setActionError("");
    try {
      const response = await shareApi.systemStorageConfig(storageConfigID);
      const item = response.item;
      setForm({
        name: item.name || "",
        provider: item.provider || "local",
        endpoint: item.endpoint || "",
        region: item.region || "",
        bucket: item.bucket || "",
        accessKey: "",
        secretKey: "",
        pathStyle: item.path_style,
        isDefault: item.is_default,
        extraConfig: item.extra_config || "",
      });
    } catch (error) {
      setActionError(getShareErrorMessage(error, "加载存储配置失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setSuccessMessage("");

    try {
      if (mode === "create") {
        await shareApi.createSystemStorageConfig({
          name: form.name.trim(),
          provider: form.provider,
          endpoint: form.endpoint.trim(),
          region: form.region.trim(),
          bucket: form.bucket.trim(),
          access_key: form.accessKey.trim(),
          secret_key: form.secretKey.trim(),
          path_style: form.pathStyle,
          is_default: form.isDefault,
          extra_config: form.extraConfig.trim(),
        });
        setForm(emptyStorageForm);
        setSuccessMessage("存储配置已创建。");
      } else {
        const updatePayload: Parameters<typeof shareApi.updateSystemStorageConfig>[1] = {
          name: form.name.trim(),
          provider: form.provider,
          endpoint: form.endpoint.trim(),
          region: form.region.trim(),
          bucket: form.bucket.trim(),
          path_style: form.pathStyle,
          is_default: form.isDefault,
          extra_config: form.extraConfig.trim(),
        };
        if (form.accessKey.trim()) {
          updatePayload.access_key = form.accessKey.trim();
        }
        if (form.secretKey.trim()) {
          updatePayload.secret_key = form.secretKey.trim();
        }
        await shareApi.updateSystemStorageConfig(storageConfigID, updatePayload);
        setForm((current) => ({
          ...current,
          accessKey: "",
          secretKey: "",
        }));
        setSuccessMessage("存储配置已更新。");
      }
    } catch (error) {
      setActionError(
        getShareErrorMessage(
          error,
          mode === "create" ? "创建存储配置失败，请稍后重试。" : "更新存储配置失败，请稍后重试。",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const pagePath = mode === "create" ? "/system/storage/new" : `/system/storage/${encodeURIComponent(storageConfigID)}/edit`;

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/storage" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath={pagePath} />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/storage" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/storage"
      title={mode === "create" ? "新增存储配置" : "修改存储配置"}
      description={
        mode === "create"
          ? "在这里创建新的本地、阿里云 OSS、S3 或 MinIO 存储配置。"
          : "在这里修改现有存储配置。Access Key 和 Secret Key 留空则保持原值不变。"
      }
    >
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <SystemBackLink href="/system/storage" label="返回列表" />

      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">{mode === "create" ? "配置表单" : "编辑表单"}</h2>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="配置名称"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="例如：阿里云 OSS 主存储"
            required
          />

          <SelectField
            label="Provider"
            value={form.provider}
            onChange={(value) => setForm((current) => ({ ...current, provider: value }))}
            options={[
              { label: "本地存储 (Local)", value: "local" },
              { label: "Amazon S3", value: "s3" },
              { label: "MinIO", value: "minio" },
              { label: "阿里云 OSS", value: "oss" },
              { label: "腾讯云 COS", value: "cos" },
            ]}
          />

          <TextField
            label="Endpoint"
            value={form.endpoint}
            onChange={(value) => setForm((current) => ({ ...current, endpoint: value }))}
            placeholder="例如：oss-cn-hangzhou.aliyuncs.com"
          />

          <TextField
            label="Region"
            value={form.region}
            onChange={(value) => setForm((current) => ({ ...current, region: value }))}
            placeholder="例如：cn-hangzhou"
          />

          <TextField
            label="Bucket"
            value={form.bucket}
            onChange={(value) => setForm((current) => ({ ...current, bucket: value }))}
            placeholder="例如：my-share-assets"
            required
          />

          <TextField
            label="Access Key"
            value={form.accessKey}
            onChange={(value) => setForm((current) => ({ ...current, accessKey: value }))}
            placeholder={mode === "edit" ? "留空则保持原值" : "请输入 Access Key ID"}
          />

          <PasswordField
            label="Secret Key"
            value={form.secretKey}
            onChange={(value) => setForm((current) => ({ ...current, secretKey: value }))}
            placeholder={mode === "edit" ? "留空则保持原值" : "请输入 Access Key Secret"}
          />

          <TextAreaField
            label="额外配置 JSON"
            value={form.extraConfig}
            onChange={(value) => setForm((current) => ({ ...current, extraConfig: value }))}
            placeholder='例如：{"path_style": true}'
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              label="Path Style"
              checked={form.pathStyle}
              onChange={(checked) => setForm((current) => ({ ...current, pathStyle: checked }))}
            />
            <ToggleField
              label="设为默认配置"
              checked={form.isDefault}
              onChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))}
            />
          </div>

          <div className="rounded-[20px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/62">
            阿里云 OSS 常见填写方式：Provider 选 `oss`，Endpoint 填 `oss-cn-xxx.aliyuncs.com`，Region 填 `cn-xxx`，Bucket 填你的 Bucket 名称。
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (mode === "create" ? "创建中..." : "保存中...") : mode === "create" ? "创建存储配置" : "保存修改"}
            </button>
          </div>
        </form>
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
  return <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">{message}</p>;
}

function SuccessNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#d9eed6] bg-[#f3fbf1] px-5 py-4 text-sm font-bold text-[#2f6d37]">{message}</p>;
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  const { label, value, onChange, placeholder, required = false } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="dream-input w-full px-4 py-3"
        required={required}
      />
    </label>
  );
}

function PasswordField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="dream-input w-full px-4 py-3"
      />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="dream-textarea w-full px-4 py-3"
      />
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  const { label, value, onChange, options } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="dream-input w-full px-4 py-3">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <label className="dream-panel-soft flex items-center justify-between rounded-[24px] px-4 py-4 text-sm font-black text-[var(--foreground)]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}
