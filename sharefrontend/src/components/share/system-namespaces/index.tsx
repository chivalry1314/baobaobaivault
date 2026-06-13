"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useConfirm } from "@/components/share/confirm-dialog";

import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { parseOptionalPositiveInt } from "@/components/share/system-shared/helpers";
import { useToast } from "@/components/share/toast";
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
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [deletingId, setDeletingId] = useState("");
  const [loadError, setLoadError] = useState("");
  const showToast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadData(1);
    }
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
    const confirmed = await confirm({
      title: "删除命名空间",
      description: "确认删除这个命名空间吗？如果里面还有对象，需要先清空对象后才能删除。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    try {
      await shareApi.deleteSystemNamespace(id);
      showToast("命名空间已删除。", "success");
      const nextTotalPages = Math.max(1, Math.ceil(Math.max(total - 1, 0) / pageSize));
      await loadData(Math.min(page, nextTotalPages));
    } catch (error) {
      showToast(getShareErrorMessage(error, "删除命名空间失败，请稍后重试。"), "error");
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

      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--outline)]/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-[var(--foreground)]">现有命名空间</h2>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
              第 {safePage} / {totalPages} 页，共 {total} 个命名空间
            </p>
          </div>
          <Link
            href="/system/namespaces/new"
            className="inline-flex items-center justify-center rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
          >
            新增命名空间
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-6 text-center text-xs font-black text-[var(--foreground)]/60">
              <p>暂时还没有命名空间。</p>
              <Link
                href="/system/namespaces/new"
                className="mt-3 inline-flex rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
              >
                去创建第一个命名空间
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-[1rem] border-2 border-[var(--outline)] bg-white p-3 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-[var(--foreground)]">{item.name}</h3>
                    <span className="rounded-full border border-[var(--outline)]/15 bg-white px-1.5 py-0.5 text-[9px] font-black text-[var(--foreground)]/50">
                      {item.status || "active"}
                    </span>
                    {item.description ? (
                      <span className="block w-full truncate text-[10px] font-bold text-[var(--foreground)]/50">{item.description}</span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      href={`/system/namespaces/${item.id}/edit`}
                      className="inline-flex items-center rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
                    >
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="inline-flex items-center rounded-full border border-[#f1c5cc] bg-white px-2 py-1 text-[10px] font-black text-[#cf425d] shadow-sm transition hover:border-[#cf425d] hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-bold text-[var(--foreground)]/55 sm:grid-cols-4">
                  <p className="min-w-0 truncate">
                    <span className="text-[var(--foreground)]/40">前缀</span> {item.path_prefix || "-"}
                  </p>
                  <p className="min-w-0 truncate">
                    <span className="text-[var(--foreground)]/40">存储</span> {item.storage_config?.name || item.storage_config_id || "默认"}
                  </p>
                  <p className="min-w-0 truncate">
                    <span className="text-[var(--foreground)]/40">文件</span> {item.used_files}{item.max_files ? `/${item.max_files}` : ""}
                  </p>
                  <p className="min-w-0 truncate">
                    <span className="text-[var(--foreground)]/40">容量</span> {item.used_storage}{item.max_storage ? `/${item.max_storage}` : ""}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-4" />
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
  const [loading, setLoading] = useState(mode === "edit" && !!user?.isConfiguredSuperAdmin);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const showToast = useToast();

  const loadFormData = useCallback(async () => {
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
  }, [mode, namespaceID]);

  useEffect(() => {
    if (mode === "edit" && user?.isConfiguredSuperAdmin) {
      void loadFormData();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin, mode, namespaceID, loadFormData]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

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
        showToast("命名空间已更新。", "success");
        router.push("/system/namespaces");
      } else {
        await shareApi.createSystemNamespace(payload);
        showToast("命名空间已创建。", "success");
        router.push("/system/namespaces");
      }
    } catch (error) {
      showToast(
        getShareErrorMessage(
          error,
          mode === "edit" ? "更新命名空间失败，请稍后重试。" : "创建命名空间失败，请稍后重试。",
        ),
        "error",
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

      <div className="mx-auto mb-4 flex max-w-3xl items-start gap-3">
        <Link
          href="/system/namespaces"
          title="返回列表"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--outline)]/20 bg-white text-base font-black text-[var(--foreground)]/70 shadow-sm transition hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-xl font-black leading-tight text-[var(--foreground)]">{mode === "edit" ? "编辑命名空间" : "新增命名空间"}</h1>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--foreground)]/55">
            {mode === "edit"
              ? "修改命名空间的说明、路径前缀、容量配额和绑定存储配置。"
              : "创建新的命名空间，用于隔离不同类型的对象和配额。"}
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-3xl rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="border-b border-[var(--outline)]/20 pb-3">
          <h2 className="text-base font-black text-[var(--foreground)]">{mode === "edit" ? "命名空间表单" : "新增表单"}</h2>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
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

          <div className="rounded-xl border border-[var(--outline)]/15 bg-[var(--surface-container)] px-3 py-2.5 text-[10px] font-bold leading-5 text-[var(--foreground)]/60">
            如果你准备把卡片封面和附件切到 OSS，建议至少建两个命名空间：一个给封面，一个给附件。这样后续做配额和管理会更清晰。
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || Boolean(loadError)}
              className="rounded-full bg-[var(--button-primary)] px-5 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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
      <div className="rounded-[1.2rem] border-2 border-[var(--outline)] bg-white px-5 py-6 text-sm font-bold text-[var(--foreground)]/70 shadow-sm">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="rounded-[1.2rem] border-2 border-[var(--outline)] bg-white px-5 py-6 shadow-sm">
        <p className="text-sm font-bold leading-6 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="rounded-xl border border-[#f3c8ad] bg-[#fff4ec] px-3 py-2 text-xs font-black text-[#9a3412]">{message}</p>;
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
