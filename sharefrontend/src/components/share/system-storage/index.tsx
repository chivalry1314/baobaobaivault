"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useConfirm } from "@/components/share/confirm-dialog";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { StorageConfigForm } from "@/components/share/system-storage/form";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareStorageConfig } from "@/lib/shared";

const PAGE_SIZE = 10;

export function ShareSystemStoragePage() {
  const { user, sessionChecking } = useShareSession();
  const [items, setItems] = useState<ShareStorageConfig[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [deletingId, setDeletingId] = useState("");
  const [loadError, setLoadError] = useState("");
  const showToast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadStorageConfigs();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length]);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

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
    const confirmed = await confirm({
      title: "删除存储配置",
      description: "确认删除这条存储配置吗？",
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    try {
      await shareApi.deleteSystemStorageConfig(id);
      showToast("存储配置已删除。", "success");
      await loadStorageConfigs();
    } catch (error) {
      showToast(getShareErrorMessage(error, "删除存储配置失败，请稍后重试。"), "error");
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

      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--outline)]/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-[var(--foreground)]">现有配置</h2>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
              第 {safePage} / {totalPages} 页，共 {items.length} 条配置
            </p>
          </div>
          <Link
            href="/system/storage/new"
            className="inline-flex items-center justify-center rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
          >
            新增配置
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-6 text-center text-xs font-black text-[var(--foreground)]/60">
              <p>暂时还没有存储配置。</p>
              <Link
                href="/system/storage/new"
                className="mt-3 inline-flex rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
              >
                去创建第一条配置
              </Link>
            </div>
          ) : (
            pagedItems.map((item) => (
              <article key={item.id} className="rounded-[1.1rem] border-2 border-[var(--outline)] bg-white p-3.5 shadow-sm transition hover:shadow-md sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-[var(--foreground)]">{item.name}</h3>
                    <span className="rounded-full border border-[var(--outline)]/15 bg-white px-2 py-0.5 text-[10px] font-black text-[var(--foreground)]/55">
                      {item.provider.toUpperCase()}
                    </span>
                    {item.is_default ? (
                      <span className="rounded-full border border-[#2d8d62] bg-[#e9fff2] px-2 py-0.5 text-[10px] font-black text-[#11613f]">
                        默认
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      href={`/system/storage/${encodeURIComponent(item.id)}/edit`}
                      className="inline-flex items-center rounded-full border border-[var(--outline)]/20 bg-white px-2.5 py-1.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
                    >
                      修改
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="inline-flex items-center rounded-full border border-[#f1c5cc] bg-white px-2.5 py-1.5 text-xs font-black text-[#cf425d] shadow-sm transition hover:border-[#cf425d] hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <span className="block text-[10px] font-bold text-[var(--foreground)]/45">Bucket</span>
                    <p className="break-all text-xs font-black text-[var(--foreground)]/75">{item.bucket || "-"}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[var(--foreground)]/45">Region</span>
                    <p className="break-all text-xs font-black text-[var(--foreground)]/75">{item.region || "-"}</p>
                  </div>
                  <div className="sm:col-span-1">
                    <span className="block text-[10px] font-bold text-[var(--foreground)]/45">Endpoint</span>
                    <p className="break-all text-xs font-black text-[var(--foreground)]/75">{item.endpoint || "-"}</p>
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
          className="mt-4"
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
  const router = useRouter();
  const showToast = useToast();

  const pagePath = mode === "create" ? "/system/storage/new" : `/system/storage/${encodeURIComponent(storageConfigID)}/edit`;

  if (sessionChecking) {
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
      description=""
    >
      <div className="mx-auto mb-4 flex max-w-3xl items-start gap-3">
        <Link
          href="/system/storage"
          title="返回列表"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--outline)]/20 bg-white text-base font-black text-[var(--foreground)]/70 shadow-sm transition hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-xl font-black leading-tight text-[var(--foreground)]">{mode === "create" ? "新增存储配置" : "修改存储配置"}</h1>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--foreground)]/55">
            {mode === "create"
              ? "创建本地、阿里云 OSS、S3 或 MinIO 存储配置，用于文件上传与对象管理。"
              : "修改现有存储配置，Access Key 和 Secret Key 留空则保持原值不变。"}
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-3xl rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <StorageConfigForm
          mode={mode}
          storageConfigID={storageConfigID}
          onSuccess={() => {
            showToast(mode === "create" ? "存储配置已创建。" : "存储配置已更新。", "success");
            router.push("/system/storage");
          }}
        />
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


