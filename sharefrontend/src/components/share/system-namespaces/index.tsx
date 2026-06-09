"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { SystemBackLink } from "@/components/share/system-back-link";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { parseOptionalPositiveInt } from "@/components/share/system-shared/helpers";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareNamespace, ShareStorageConfig } from "@/lib/shared";

const PAGE_SIZE = 10;

type NamespaceFormState = {
  name: string;
  description: string;
  storageConfigID: string;
  pathPrefix: string;
  maxStorage: string;
  maxFiles: string;
  maxFileSize: string;
};

const emptyNamespaceForm: NamespaceFormState = {
  name: "",
  description: "",
  storageConfigID: "",
  pathPrefix: "",
  maxStorage: "",
  maxFiles: "",
  maxFileSize: "",
};

export function ShareSystemNamespacesPage() {
  const { user, sessionChecking } = useShareSession();
  const [items, setItems] = useState<ShareNamespace[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
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
    void loadData(1);
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  async function loadData(nextPage: number) {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemNamespaces({ page: nextPage, pageSize: PAGE_SIZE });
      setItems(response.items || []);
      setPage(response.pagination?.page || nextPage);
      setPageSize(response.pagination?.pageSize || PAGE_SIZE);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载命名空间失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确认删除这个命名空间吗？如果里面还有对象，需要先清空对象后才能删除。");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setActionError("");
    setSuccessMessage("");
    try {
      await shareApi.deleteSystemNamespace(id);
      setSuccessMessage("命名空间已删除。");
      const nextTotalPages = Math.max(1, Math.ceil(Math.max(total - 1, 0) / pageSize));
      await loadData(Math.min(page, nextTotalPages));
    } catch (error) {
      setActionError(getShareErrorMessage(error, "删除命名空间失败，请稍后重试。"));
    } finally {
      setDeletingId("");
    }
  }

  async function handlePageChange(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    await loadData(nextPage);
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/namespaces" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/namespaces" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/namespaces" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/namespaces"
      title="命名空间"
      description="管理对象存储命名空间、路径前缀、容量配额，以及每个命名空间默认绑定的存储配置。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">现有命名空间</h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              第 {safePage} / {totalPages} 页，共 {total} 个命名空间
            </p>
          </div>
          <Link
            href="/system/namespaces/new"
            className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black"
          >
            新增命名空间
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
              <p>暂时还没有命名空间。</p>
              <Link href="/system/namespaces/new" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                去创建第一个命名空间
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="dream-panel-soft rounded-[22px] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-[var(--foreground)]">{item.name}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                        {item.status || "active"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-[var(--foreground)]/68">{item.description || "暂无描述"}</p>
                    <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]/68">路径前缀：{item.path_prefix || "-"}</p>
                    <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]/68">
                      绑定存储配置：{item.storage_config?.name || item.storage_config_id || "默认存储配置"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">
                      文件数：{item.used_files}{item.max_files ? ` / ${item.max_files}` : " / 不限"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">
                      存储量：{item.used_storage}{item.max_storage ? ` / ${item.max_storage}` : " / 不限"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link href={`/system/namespaces/${item.id}/edit`} className="btn-subtle inline-flex rounded-full px-4 py-2 text-sm font-black">
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="rounded-full bg-[#c94c3b] px-4 py-2 text-sm font-black text-white transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-6" />
      </section>
    </SystemWorkspace>
  );
}

export function ShareSystemNamespaceCreatePage() {
  return <ShareSystemNamespaceFormPage mode="create" />;
}

export function ShareSystemNamespaceEditPage(props: { namespaceID: string }) {
  return <ShareSystemNamespaceFormPage mode="edit" namespaceID={props.namespaceID} />;
}

function ShareSystemNamespaceFormPage(props: { mode: "create" | "edit"; namespaceID?: string }) {
  const { mode, namespaceID = "" } = props;
  const { user, sessionChecking } = useShareSession();
  const [storageConfigs, setStorageConfigs] = useState<ShareStorageConfig[]>([]);
  const [form, setForm] = useState<NamespaceFormState>(emptyNamespaceForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadFormData();
  }, [user?.id, user?.isConfiguredSuperAdmin, mode, namespaceID]);

  async function loadFormData() {
    setLoading(true);
    setLoadError("");
    try {
      const [storageResponse, namespaceResponse] = await Promise.all([
        shareApi.systemStorageConfigs(),
        mode === "edit" ? shareApi.systemNamespace(namespaceID) : Promise.resolve(null),
      ]);

      setStorageConfigs(storageResponse.items || []);

      if (mode === "edit") {
        const target = namespaceResponse?.item;
        if (!target) {
          setLoadError("没有找到要编辑的命名空间，可能已被删除。");
          return;
        }
        setForm({
          name: target.name || "",
          description: target.description || "",
          storageConfigID: target.storage_config_id || "",
          pathPrefix: target.path_prefix || "",
          maxStorage: target.max_storage ? String(target.max_storage) : "",
          maxFiles: target.max_files ? String(target.max_files) : "",
          maxFileSize: target.max_file_size ? String(target.max_file_size) : "",
        });
      }
    } catch (error) {
      setLoadError(
        getShareErrorMessage(
          error,
          mode === "edit" ? "加载命名空间详情失败，请稍后重试。" : "加载表单数据失败，请稍后重试。",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setSuccessMessage("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      storage_config_id: form.storageConfigID || undefined,
      path_prefix: form.pathPrefix.trim() || undefined,
      max_storage: parseOptionalPositiveInt(form.maxStorage),
      max_files: parseOptionalPositiveInt(form.maxFiles),
      max_file_size: parseOptionalPositiveInt(form.maxFileSize),
    };

    try {
      if (mode === "edit") {
        await shareApi.updateSystemNamespace(namespaceID, payload);
        setSuccessMessage("命名空间已更新。");
      } else {
        await shareApi.createSystemNamespace(payload);
        setForm(emptyNamespaceForm);
        setSuccessMessage("命名空间已创建。");
      }
    } catch (error) {
      setActionError(
        getShareErrorMessage(
          error,
          mode === "edit" ? "更新命名空间失败，请稍后重试。" : "创建命名空间失败，请稍后重试。",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const nextPath = mode === "edit" ? `/system/namespaces/${namespaceID}/edit` : "/system/namespaces/new";

  if (sessionChecking || loading) {
    return (
      <SystemLoadingPage
        currentPath="/system/namespaces"
        text={mode === "edit" ? "正在加载命名空间详情..." : "正在检查系统管理权限..."}
      />
    );
  }

  if (!user) {
    return <AuthRedirect nextPath={nextPath} />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/namespaces" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/namespaces"
      title={mode === "edit" ? "编辑命名空间" : "新增命名空间"}
      description={
        mode === "edit"
          ? "在这里修改命名空间的说明、路径前缀、容量配额和绑定存储配置。"
          : "在这里创建新的命名空间，用于隔离不同类型的对象和配额。"
      }
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <SystemBackLink href="/system/namespaces" label="返回列表" />

      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">{mode === "edit" ? "命名空间表单" : "新增表单"}</h2>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="命名空间名称"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="例如：share-assets"
            required
          />

          <TextAreaField
            label="描述"
            value={form.description}
            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
            placeholder="可选说明，例如：卡片封面资源空间"
          />

          <SelectField
            label="绑定存储配置"
            value={form.storageConfigID}
            onChange={(value) => setForm((current) => ({ ...current, storageConfigID: value }))}
            options={[
              { label: "默认存储配置", value: "" },
              ...storageConfigs.map((item) => ({ label: `${item.name} (${item.provider})`, value: item.id })),
            ]}
          />

          <TextField
            label="路径前缀"
            value={form.pathPrefix}
            onChange={(value) => setForm((current) => ({ ...current, pathPrefix: value }))}
            placeholder="例如：share/files"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="最大存储字节数"
              value={form.maxStorage}
              onChange={(value) => setForm((current) => ({ ...current, maxStorage: value }))}
              placeholder="留空表示不限"
            />
            <TextField
              label="最大文件数"
              value={form.maxFiles}
              onChange={(value) => setForm((current) => ({ ...current, maxFiles: value }))}
              placeholder="留空表示不限"
            />
            <TextField
              label="单文件最大字节数"
              value={form.maxFileSize}
              onChange={(value) => setForm((current) => ({ ...current, maxFileSize: value }))}
              placeholder="留空表示不限"
            />
          </div>

          <div className="rounded-[20px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/62">
            如果你准备把卡片封面和附件切到 OSS，建议至少建两个命名空间：一个给封面，一个给附件。这样后续做配额和管理会更清晰。
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || Boolean(loadError)}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (mode === "edit" ? "保存中..." : "创建中...") : mode === "edit" ? "保存命名空间" : "创建命名空间"}
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
