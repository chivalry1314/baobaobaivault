"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useShareSession } from "@/components/share/session-provider";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";

export type StorageFormMode = "create" | "edit";

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

type StorageConfigFormProps = {
  mode: StorageFormMode;
  storageConfigID?: string;
  onSuccess?: () => void;
  className?: string;
};

export function StorageConfigForm(props: StorageConfigFormProps) {
  const { mode, storageConfigID = "", onSuccess, className = "" } = props;
  const { user, sessionChecking } = useShareSession();
  const [form, setForm] = useState<StorageFormState>(emptyStorageForm);
  const [loading, setLoading] = useState(mode === "edit" && !!user?.isConfiguredSuperAdmin);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  const loadCurrentConfig = useCallback(async () => {
    setLoading(true);
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
      showToast(getShareErrorMessage(error, "加载存储配置失败，请稍后重试。"), "error");
    } finally {
      setLoading(false);
    }
  }, [storageConfigID, showToast]);

  useEffect(() => {
    if (mode === "edit" && user?.isConfiguredSuperAdmin) {
      void loadCurrentConfig();
    }
  }, [mode, storageConfigID, user?.id, user?.isConfiguredSuperAdmin, loadCurrentConfig]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

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
      }
      onSuccess?.();
    } catch (error) {
      showToast(
        getShareErrorMessage(
          error,
          mode === "create" ? "创建存储配置失败，请稍后重试。" : "更新存储配置失败，请稍后重试。",
        ),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (sessionChecking || loading) {
    return (
      <div className={`flex items-center justify-center py-12 text-xs font-black text-[var(--foreground)]/55 ${className}`}>
        {mode === "edit" ? "正在加载配置..." : "正在检查权限..."}
      </div>
    );
  }

  if (!user?.isConfiguredSuperAdmin) {
    return (
      <div className={`rounded-xl border border-[var(--outline)]/20 bg-[var(--surface-container)] px-4 py-5 text-xs font-black text-[var(--foreground)]/70 ${className}`}>
        当前账号不是系统初始化超级管理员，无法访问此页面。
      </div>
    );
  }

  return (
    <div className={className}>
      <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
        <FormSection title="基本信息">
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
        </FormSection>

        <FormSection title="连接信息">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <TextField
            label="Bucket"
            value={form.bucket}
            onChange={(value) => setForm((current) => ({ ...current, bucket: value }))}
            placeholder="例如：my-share-assets"
            required
          />
        </FormSection>

        <FormSection title="访问凭证">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </FormSection>

        <FormSection title="高级选项">
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
          <TextAreaField
            label="额外配置 JSON"
            value={form.extraConfig}
            onChange={(value) => setForm((current) => ({ ...current, extraConfig: value }))}
            placeholder='例如：{"path_style": true}'
          />
        </FormSection>

        <div className="rounded-xl border border-[var(--outline)]/15 bg-[var(--surface-container)] px-3 py-2.5 text-[10px] font-bold leading-5 text-[var(--foreground)]/60">
          阿里云 OSS 常见填写方式：Provider 选 `oss`，Endpoint 填 `oss-cn-xxx.aliyuncs.com`，Region 填 `cn-xxx`，Bucket 填你的 Bucket 名称。
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[var(--button-primary)] px-5 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (mode === "create" ? "创建中..." : "保存中...") : mode === "create" ? "创建存储配置" : "保存修改"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormSection(props: { title: string; children: ReactNode }) {
  const { title, children } = props;
  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/45">{title}</h3>
      <div className="space-y-2 rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)]/40 p-3">{children}</div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15";

function TextField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  const { label, value, onChange, placeholder, required = false } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClassName} required={required} />
    </label>
  );
}

function PasswordField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span>
      <input type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
      />
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  const { label, value, onChange, options } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName}>
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
    <label className="flex items-center justify-between rounded-xl border-2 border-[var(--outline)]/20 bg-white px-3 py-2.5 text-xs font-black text-[var(--foreground)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--outline)]/30 text-[var(--primary)]"
      />
    </label>
  );
}


