"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useConfirm } from "@/components/share/confirm-dialog";

import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  ShareNamespace,
  ShareObjectVersion,
  SharePreparedPresignPut,
  ShareStorageObject,
} from "@/lib/shared";

const emptyUploadForm = {
  key: "",
  contentType: "",
  metadata: "",
};

const OBJECT_PAGE_SIZE = 10;
const VERSION_PAGE_SIZE = 10;

export function ShareSystemObjectsPage() {
  const { user, sessionChecking } = useShareSession();
  const [namespaces, setNamespaces] = useState<ShareNamespace[]>([]);
  const [selectedNamespaceID, setSelectedNamespaceID] = useState("");
  const [prefix, setPrefix] = useState("");
  const [appliedPrefix, setAppliedPrefix] = useState("");
  const [objects, setObjects] = useState<ShareStorageObject[]>([]);
  const [versions, setVersions] = useState<ShareObjectVersion[]>([]);
  const [selectedObjectKey, setSelectedObjectKey] = useState("");
  const [objectPage, setObjectPage] = useState(1);
  const [objectPageSize, setObjectPageSize] = useState(OBJECT_PAGE_SIZE);
  const [objectTotal, setObjectTotal] = useState(0);
  const [versionPage, setVersionPage] = useState(1);
  const [versionPageSize, setVersionPageSize] = useState(VERSION_PAGE_SIZE);
  const [versionTotal, setVersionTotal] = useState(0);
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [rollingBackVersionID, setRollingBackVersionID] = useState("");
  const [presigningKey, setPresigningKey] = useState("");
  const [presignGetUrl, setPresignGetUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const showToast = useToast();
  const confirm = useConfirm();

  const selectedNamespace = useMemo(
    () => namespaces.find((item) => item.id === selectedNamespaceID) || null,
    [namespaces, selectedNamespaceID],
  );
  const selectedObject = useMemo(
    () => objects.find((item) => item.key === selectedObjectKey) || null,
    [objects, selectedObjectKey],
  );

  const objectTotalPages = Math.max(1, Math.ceil(objectTotal / objectPageSize));
  const versionTotalPages = Math.max(1, Math.ceil(versionTotal / versionPageSize));

  const loadNamespaces = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemNamespaces({ page: 1, pageSize: 100 });
      const items = response.items || [];
      setNamespaces(items);
      if (!selectedNamespaceID && items.length > 0) {
        setSelectedNamespaceID(items[0].id);
      }
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载命名空间失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, [selectedNamespaceID]);

  const loadObjects = useCallback(async (namespaceID: string, nextPrefix: string, nextPage: number) => {
    setLoadingObjects(true);
    try {
      const response = await shareApi.systemObjects({
        namespaceID,
        prefix: nextPrefix.trim() || undefined,
        page: nextPage,
        pageSize: OBJECT_PAGE_SIZE,
      });
      const nextItems = response.items || [];
      setObjects(nextItems);
      setAppliedPrefix(nextPrefix);
      setObjectPage(response.page || nextPage);
      setObjectPageSize(response.pageSize || OBJECT_PAGE_SIZE);
      setObjectTotal(response.total || 0);
      if (selectedObjectKey && !nextItems.some((item) => item.key === selectedObjectKey)) {
        setSelectedObjectKey("");
        setVersions([]);
        setVersionPage(1);
        setVersionTotal(0);
      }
    } catch (error) {
      showToast(getShareErrorMessage(error, "加载对象列表失败，请稍后重试。"), "error");
    } finally {
      setLoadingObjects(false);
    }
  }, [selectedObjectKey, showToast]);

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadNamespaces();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin, loadNamespaces]);

  useEffect(() => {
    if (!selectedNamespaceID) {
      setObjects([]);
      setVersions([]);
      setSelectedObjectKey("");
      setPresignGetUrl("");
      setObjectPage(1);
      setObjectTotal(0);
      setVersionPage(1);
      setVersionTotal(0);
      return;
    }
    void loadObjects(selectedNamespaceID, prefix, 1);
  }, [selectedNamespaceID, prefix, loadObjects]);

  async function loadVersions(namespaceID: string, key: string, nextPage: number) {
    setLoadingVersions(true);
    try {
      const response = await shareApi.systemObjectVersions({
        namespaceID,
        key,
        page: nextPage,
        pageSize: VERSION_PAGE_SIZE,
      });
      setVersions(response.items || []);
      setVersionPage(response.page || nextPage);
      setVersionPageSize(response.pageSize || VERSION_PAGE_SIZE);
      setVersionTotal(response.total || 0);
    } catch (error) {
      showToast(getShareErrorMessage(error, "加载对象版本失败，请稍后重试。"), "error");
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNamespaceID) {
      return;
    }
    setObjectPage(1);
    setSelectedObjectKey("");
    setVersions([]);
    setVersionPage(1);
    setVersionTotal(0);
    setPresignGetUrl("");
    await loadObjects(selectedNamespaceID, prefix, 1);
  }

  async function handleDelete(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }

    const confirmed = await confirm({
      title: "删除对象",
      description: `确认删除对象“${item.key}”吗？该对象的所有版本也会一起删除。`,
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setDeletingKey(item.key);
    try {
      await shareApi.deleteSystemObject({
        namespaceID: selectedNamespaceID,
        key: item.key,
      });
      showToast("对象已删除。", "success");
      if (selectedObjectKey === item.key) {
        setSelectedObjectKey("");
        setVersions([]);
        setVersionPage(1);
        setVersionTotal(0);
      }
      const nextTotalPages = Math.max(1, Math.ceil(Math.max(objectTotal - 1, 0) / objectPageSize));
      await loadObjects(selectedNamespaceID, appliedPrefix, Math.min(objectPage, nextTotalPages));
    } catch (error) {
      showToast(getShareErrorMessage(error, "删除对象失败，请稍后重试。"), "error");
    } finally {
      setDeletingKey("");
    }
  }

  async function handleDownload(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }

    try {
      const result = await shareApi.downloadSystemObject({
        namespaceID: selectedNamespaceID,
        key: item.key,
      });
      const blobUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = item.name || result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      showToast(getShareErrorMessage(error, "下载对象失败，请稍后重试。"), "error");
    }
  }

  async function handleViewVersions(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }
    setSelectedObjectKey(item.key);
    setVersionPage(1);
    setPresignGetUrl("");
    await loadVersions(selectedNamespaceID, item.key, 1);
  }

  async function handleRollback(versionID: string) {
    if (!selectedNamespaceID || !selectedObjectKey) {
      return;
    }

    setRollingBackVersionID(versionID);
    try {
      await shareApi.rollbackSystemObjectVersion({
        namespaceID: selectedNamespaceID,
        key: selectedObjectKey,
        versionID,
      });
      showToast("版本回滚成功。", "success");
      await loadObjects(selectedNamespaceID, appliedPrefix, objectPage);
      await loadVersions(selectedNamespaceID, selectedObjectKey, versionPage);
    } catch (error) {
      showToast(getShareErrorMessage(error, "版本回滚失败，请稍后重试。"), "error");
    } finally {
      setRollingBackVersionID("");
    }
  }

  async function handlePresignGet(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }

    setPresigningKey(item.key);
    try {
      const response = await shareApi.systemPresignGetObject({
        namespaceID: selectedNamespaceID,
        key: item.key,
        ttlSeconds: 300,
      });
      setPresignGetUrl(response.data.url);
      showToast("预签名下载地址已生成。", "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "生成预签名下载地址失败，请稍后重试。"), "error");
    } finally {
      setPresigningKey("");
    }
  }

  async function handleObjectPageChange(nextPage: number) {
    if (!selectedNamespaceID || loadingObjects || nextPage < 1 || nextPage > objectTotalPages || nextPage === objectPage) {
      return;
    }
    await loadObjects(selectedNamespaceID, appliedPrefix, nextPage);
  }

  async function handleVersionPageChange(nextPage: number) {
    if (!selectedNamespaceID || !selectedObjectKey || loadingVersions || nextPage < 1 || nextPage > versionTotalPages || nextPage === versionPage) {
      return;
    }
    await loadVersions(selectedNamespaceID, selectedObjectKey, nextPage);
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/objects" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/objects" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/objects" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/objects"
      title="对象管理"
      description="这里用于查询对象、查看版本、回滚历史版本，以及测试下载与预签名下载。上传操作已拆到独立页面。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <div className="grid gap-4">
        <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--outline)]/20 pb-3">
            <div>
              <h2 className="text-base font-black text-[var(--foreground)]">对象资源工作台</h2>
              <p className="mt-0.5 text-xs font-bold text-[var(--foreground)]/55">
                查询对象、查看版本、回滚历史版本，以及测试下载与预签名下载。
              </p>
            </div>
            <Link
              href="/system/objects/new"
              className="inline-flex items-center justify-center rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
            >
              上传对象
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">当前命名空间</span>
            <OverviewPill label="命名空间" value={selectedNamespace?.name || "未选择"} />
            <OverviewPill label="对象总数" value={selectedNamespaceID ? String(objectTotal) : "-"} />
            <OverviewPill label="页码" value={selectedNamespaceID ? `${objectPage}/${objectTotalPages}` : "-"} />
          </div>

          <form
            className="mt-3 grid gap-2 rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)]/40 p-3 sm:grid-cols-[1.2fr_1fr_auto_auto]"
            onSubmit={handleFilterSubmit}
          >
            <SelectField
              value={selectedNamespaceID}
              onChange={(value) => {
                setSelectedNamespaceID(value);
                setSelectedObjectKey("");
                setVersions([]);
                setPresignGetUrl("");
              }}
              options={[
                { label: namespaces.length > 0 ? "请选择命名空间" : "暂无命名空间", value: "" },
                ...namespaces.map((item) => ({ label: item.name, value: item.id })),
              ]}
            />
            <TextField value={prefix} onChange={setPrefix} placeholder="对象前缀，例如 cards/creator-a/" />
            <button
              type="submit"
              disabled={!selectedNamespaceID || loadingObjects}
              className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--button-primary)] px-4 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingObjects ? "查询中..." : "查询对象"}
            </button>
            <button
              type="button"
              disabled={loadingObjects}
              onClick={() => {
                setPrefix("");
                setAppliedPrefix("");
                setSelectedObjectKey("");
                setVersions([]);
                setVersionPage(1);
                setVersionTotal(0);
                setPresignGetUrl("");
                if (selectedNamespaceID) {
                  void loadObjects(selectedNamespaceID, "", 1);
                }
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white px-4 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              重置
            </button>
          </form>

          {selectedNamespace ? (
            <p className="mt-2 text-[10px] font-bold text-[var(--foreground)]/50">
              当前：{selectedNamespace.name}{appliedPrefix ? ` · 前缀 ${appliedPrefix}` : ""}
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--outline)]/20 pb-3">
              <h3 className="text-base font-black text-[var(--foreground)]">对象列表</h3>
              <p className="text-[10px] font-bold text-[var(--foreground)]/55">
                {selectedNamespace ? `第 ${objectPage}/${objectTotalPages} 页，共 ${objectTotal} 条` : "请选择命名空间"}
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {!selectedNamespaceID ? (
                <EmptyState title="还没有选择命名空间" description="先在上方选择一个命名空间，系统会自动加载该空间下的对象列表。" />
              ) : loadingObjects ? (
                <p className="text-xs font-bold text-[var(--foreground)]/55">正在加载对象列表...</p>
              ) : objects.length === 0 ? (
                <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-6 text-center text-xs font-black text-[var(--foreground)]/60">
                  <p>当前筛选条件下暂无对象。</p>
                  <Link
                    href="/system/objects/new"
                    className="mt-3 inline-flex rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
                  >
                    去上传对象
                  </Link>
                </div>
              ) : (
                objects.map((item) => {
                  const isSelected = selectedObjectKey === item.key;
                  return (
                    <article
                      key={item.id}
                      className={[
                        "rounded-[1.1rem] border-2 p-3 transition hover:shadow-md sm:p-4",
                        isSelected
                          ? "border-[var(--brand)]/40 bg-[var(--brand)]/5"
                          : "border-[var(--outline)] bg-white",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-[var(--outline)]/15 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/60">
                              {item.content_type?.split("/")[0] || "object"}
                            </span>
                            <span className="rounded-full border border-[var(--outline)]/15 bg-white px-2 py-0.5 text-[9px] font-black text-[var(--foreground)]/60">
                              {formatBytes(item.size)}
                            </span>
                            {item.version_id ? (
                              <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/8 px-2 py-0.5 text-[9px] font-black text-[var(--foreground)]/70">
                                {trimMiddle(item.version_id, 14)}
                              </span>
                            ) : null}
                          </div>

                          <h4 className="mt-2 break-all text-sm font-black leading-snug text-[var(--foreground)]">{item.key}</h4>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <ObjectInfoCell label="文件名" value={item.name || "-"} />
                            <ObjectInfoCell label="更新时间" value={formatDateTime(item.last_modified || item.updated_at)} />
                            <ObjectInfoCell label="Content-Type" value={item.content_type || "-"} breakAll />
                            <ObjectInfoCell label="ETag" value={trimMiddle(item.etag || "-", 24)} breakAll />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 xl:w-[120px] xl:grid-cols-1">
                          <button
                            type="button"
                            onClick={() => void handleDownload(item)}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
                          >
                            下载
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleViewVersions(item)}
                            className={[
                              "inline-flex items-center justify-center rounded-full px-2 py-1.5 text-[10px] font-black transition",
                              isSelected
                                ? "bg-[var(--button-primary)] text-[var(--foreground)]"
                                : "border border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78 hover:bg-[var(--surface-container)]",
                            ].join(" ")}
                          >
                            版本
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePresignGet(item)}
                            disabled={presigningKey === item.key}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {presigningKey === item.key ? "生成中..." : "预签名"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingKey === item.key}
                            className="inline-flex items-center justify-center rounded-full border border-[#f1c5cc] bg-white px-2 py-1.5 text-[10px] font-black text-[#cf425d] shadow-sm transition hover:border-[#cf425d] hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingKey === item.key ? "删除中..." : "删除"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <PaginationControls
              page={objectPage}
              totalPages={objectTotalPages}
              onPageChange={(nextPage) => void handleObjectPageChange(nextPage)}
              className="mt-4"
            />
          </section>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-base font-black text-[var(--foreground)]">当前对象详情</h3>
              {selectedObject ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">Object Key</p>
                    <p className="mt-0.5 break-all text-xs font-black text-[var(--foreground)]">{selectedObject.key}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MetricPill label="大小" value={formatBytes(selectedObject.size)} />
                    <MetricPill label="版本数" value={String(versionTotal)} />
                    <MetricPill label="文件名" value={selectedObject.name || "-"} breakAll />
                    <MetricPill label="更新时间" value={formatDateTime(selectedObject.last_modified || selectedObject.updated_at)} />
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs font-bold leading-5 text-[var(--foreground)]/55">
                  先在左侧点击“版本”，这里会显示当前对象摘要，并同步加载版本记录。
                </p>
              )}
            </section>

            <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--outline)]/20 pb-3">
                <h3 className="text-base font-black text-[var(--foreground)]">对象版本</h3>
                <p className="text-[10px] font-bold text-[var(--foreground)]/55">
                  {selectedObjectKey ? `${versionPage}/${versionTotalPages} 页 · ${versionTotal} 条` : "未选择"}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {selectedObjectKey ? (
                  loadingVersions ? (
                    <p className="text-xs font-bold text-[var(--foreground)]/55">正在加载版本...</p>
                  ) : versions.length === 0 ? (
                    <EmptyState title="暂无版本记录" description="这个对象目前没有可以展示的历史版本。" compact />
                  ) : (
                    versions.map((version) => (
                      <article key={version.id} className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-[var(--outline)]/15 bg-white px-2 py-0.5 text-[9px] font-black text-[var(--foreground)]/60">
                            {trimMiddle(version.version_id, 14)}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--foreground)]/55">{formatBytes(version.size)}</span>
                          {version.is_latest ? (
                            <span className="rounded-full border border-[#2d8d62] bg-[#e9fff2] px-2 py-0.5 text-[9px] font-black text-[#11613f]">
                              当前版本
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 grid gap-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
                          <p className="break-all">ETag：{version.etag || "-"}</p>
                          <p>创建：{formatDateTime(version.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRollback(version.version_id)}
                          disabled={version.is_latest || rollingBackVersionID === version.version_id}
                          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rollingBackVersionID === version.version_id
                            ? "回滚中..."
                            : version.is_latest
                              ? "当前版本"
                              : "回滚到此版本"}
                        </button>
                      </article>
                    ))
                  )
                ) : (
                  <EmptyState title="还没有选中对象" description="左侧点击“版本”后，这里会加载该对象的版本列表。" compact />
                )}
              </div>

              <PaginationControls
                page={versionPage}
                totalPages={versionTotalPages}
                onPageChange={(nextPage) => void handleVersionPageChange(nextPage)}
                className="mt-3"
              />
            </section>

            <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-base font-black text-[var(--foreground)]">预签名下载地址</h3>
              {presignGetUrl ? (
                <div className="mt-3 rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2.5 text-xs font-bold leading-5 text-[var(--foreground)]/70">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">300 Seconds</p>
                  <p className="break-all">{presignGetUrl}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs font-bold leading-5 text-[var(--foreground)]/55">
                  在左侧对象卡片中点击“预签名”后，这里会显示一个 300 秒有效的下载地址。
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </SystemWorkspace>
  );
}

export function ShareSystemObjectsCreatePage() {
  const { user, sessionChecking } = useShareSession();
  const router = useRouter();
  const showToast = useToast();
  const [namespaces, setNamespaces] = useState<ShareNamespace[]>([]);
  const [selectedNamespaceID, setSelectedNamespaceID] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [presigningKey, setPresigningKey] = useState("");
  const [presignPutInfo, setPresignPutInfo] = useState<SharePreparedPresignPut | null>(null);
  const [loadError, setLoadError] = useState("");

  async function loadNamespaces() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemNamespaces({ page: 1, pageSize: 100 });
      const items = response.items || [];
      setNamespaces(items);
      if (items.length > 0) {
        setSelectedNamespaceID(items[0].id);
      }
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载命名空间失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadNamespaces();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNamespaceID) {
      showToast("请先选择命名空间。", "error");
      return;
    }
    if (!uploadFile) {
      showToast("请先选择上传文件。", "error");
      return;
    }

    setUploading(true);
    try {
      await shareApi.createSystemObject({
        namespaceID: selectedNamespaceID,
        key: uploadForm.key.trim() || uploadFile.name,
        file: uploadFile,
        contentType: uploadForm.contentType.trim() || undefined,
        metadata: uploadForm.metadata.trim() || undefined,
      });
      setUploadFile(null);
      setUploadForm(emptyUploadForm);
      setPresignPutInfo(null);
      showToast("对象上传成功。", "success");
      router.push("/system/objects");
    } catch (error) {
      showToast(getShareErrorMessage(error, "上传对象失败，请稍后重试。"), "error");
    } finally {
      setUploading(false);
    }
  }

  async function handlePresignPut() {
    if (!selectedNamespaceID) {
      showToast("请先选择命名空间。", "error");
      return;
    }
    const key = uploadForm.key.trim();
    if (!key) {
      showToast("请先填写对象 Key。", "error");
      return;
    }

    setPresigningKey("put");
    try {
      const response = await shareApi.systemPresignPutObject({
        namespaceID: selectedNamespaceID,
        key,
        ttlSeconds: 300,
      });
      setPresignPutInfo(response.data);
      showToast("预签名上传地址已生成。", "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "生成预签名上传地址失败，请稍后重试。"), "error");
    } finally {
      setPresigningKey("");
    }
  }

  async function handleCompletePresignPut() {
    if (!selectedNamespaceID || !presignPutInfo?.key || !presignPutInfo.version_id) {
      showToast("请先生成预签名上传地址。", "error");
      return;
    }

    let metadata: Record<string, string> | undefined;
    const rawMetadata = uploadForm.metadata.trim();
    if (rawMetadata) {
      try {
        const parsed = JSON.parse(rawMetadata) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          showToast("Metadata 必须是 JSON 对象。", "error");
          return;
        }
        metadata = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
      } catch {
        showToast("Metadata 不是合法的 JSON。", "error");
        return;
      }
    }

    setPresigningKey("complete");
    try {
      await shareApi.completeSystemPresignPutObject({
        namespaceID: selectedNamespaceID,
        key: presignPutInfo.key,
        versionID: presignPutInfo.version_id,
        contentType: uploadForm.contentType.trim() || undefined,
        metadata,
      });
      showToast("预签名上传结果已回写。", "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "回写预签名上传结果失败，请稍后重试。"), "error");
    } finally {
      setPresigningKey("");
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/objects" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/objects/new" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/objects" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/objects"
      title="上传对象"
      description="这里用于直接上传对象，或生成预签名上传地址后由外部客户端上传。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <div className="mx-auto mb-4 flex max-w-6xl items-start gap-3">
        <Link
          href="/system/objects"
          title="返回对象列表"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--outline)]/20 bg-white text-base font-black text-[var(--foreground)]/70 shadow-sm transition hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-xl font-black leading-tight text-[var(--foreground)]">上传对象</h1>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--foreground)]/55">
            支持直接上传，也支持先生成预签名上传地址，再由外部客户端直传对象存储并回写结果。
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--outline)]/20 pb-3">
            <h2 className="text-base font-black text-[var(--foreground)]">上传工作台</h2>
            <div className="flex flex-wrap gap-2">
              <OverviewPill label="命名空间数" value={String(namespaces.length)} />
              <OverviewPill label="当前命名空间" value={namespaces.find((item) => item.id === selectedNamespaceID)?.name || "未选择"} />
            </div>
          </div>

          <form className="mt-3 space-y-3" onSubmit={handleUpload}>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                label="命名空间"
                value={selectedNamespaceID}
                onChange={setSelectedNamespaceID}
                options={[
                  { label: namespaces.length > 0 ? "请选择命名空间" : "暂无命名空间", value: "" },
                  ...namespaces.map((item) => ({ label: item.name, value: item.id })),
                ]}
              />
              <TextField
                label="对象 Key"
                value={uploadForm.key}
                onChange={(value) => setUploadForm((current) => ({ ...current, key: value }))}
                placeholder="留空则默认使用文件名"
              />
              <TextField
                label="Content-Type"
                value={uploadForm.contentType}
                onChange={(value) => setUploadForm((current) => ({ ...current, contentType: value }))}
                placeholder="例如 image/png"
              />
              <label className="block">
                <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">文件</span>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)] file:mr-2 file:rounded-full file:border-0 file:bg-[var(--surface-container)] file:px-2 file:py-0.5 file:text-xs file:font-black"
                />
              </label>
              <div className="md:col-span-2">
                <TextAreaField
                  label="Metadata JSON"
                  value={uploadForm.metadata}
                  onChange={(value) => setUploadForm((current) => ({ ...current, metadata: value }))}
                  placeholder='例如 {"source":"sharefrontend"}'
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!selectedNamespaceID || uploading}
                className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "上传中..." : "直接上传"}
              </button>
              <button
                type="button"
                onClick={() => void handlePresignPut()}
                disabled={!selectedNamespaceID || presigningKey === "put"}
                className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {presigningKey === "put" ? "生成中..." : "生成预签名上传"}
              </button>
              <button
                type="button"
                onClick={() => void handleCompletePresignPut()}
                disabled={!selectedNamespaceID || presigningKey === "complete" || !presignPutInfo}
                className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {presigningKey === "complete" ? "回写中..." : "回写预签名上传"}
              </button>
            </div>
          </form>
        </section>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-base font-black text-[var(--foreground)]">当前上传草稿</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MetricPill label="命名空间" value={namespaces.find((item) => item.id === selectedNamespaceID)?.name || "未选择"} breakAll />
              <MetricPill label="对象 Key" value={uploadForm.key.trim() || uploadFile?.name || "将使用文件名"} breakAll />
              <MetricPill label="Content-Type" value={uploadForm.contentType.trim() || uploadFile?.type || "自动识别"} breakAll />
              <MetricPill label="Metadata" value={uploadForm.metadata.trim() ? "已填写" : "未填写"} />
            </div>

            <div className="mt-3 rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">Selected File</p>
              {uploadFile ? (
                <div className="mt-1 space-y-0.5 text-xs font-bold text-[var(--foreground)]/70">
                  <p className="break-all">{uploadFile.name}</p>
                  <p>大小：{formatBytes(uploadFile.size)}</p>
                  <p>类型：{uploadFile.type || "-"}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs font-bold text-[var(--foreground)]/55">尚未选择文件。</p>
              )}
            </div>
          </section>

          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-base font-black text-[var(--foreground)]">预签名上传结果</h3>
            {presignPutInfo ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold leading-5 text-[var(--foreground)]/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">Object Key</p>
                  <p className="break-all">{presignPutInfo.key}</p>
                </div>
                <div className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold leading-5 text-[var(--foreground)]/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">Version ID</p>
                  <p className="break-all">{presignPutInfo.version_id}</p>
                </div>
                <div className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold leading-5 text-[var(--foreground)]/70">
                  <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/40">Upload URL</p>
                  <p className="break-all">{presignPutInfo.url}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs font-bold leading-5 text-[var(--foreground)]/55">
                生成预签名上传后，这里会显示对象 Key、版本号和临时上传地址。上传完成后，再点击“回写预签名上传”。
              </p>
            )}
          </section>

          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-base font-black text-[var(--foreground)]">推荐操作流程</h3>
            <div className="mt-3 space-y-1.5 text-xs font-bold leading-5 text-[var(--foreground)]/60">
              <p>1. 普通管理场景直接用“直接上传”即可。</p>
              <p>2. 如果文件由外部客户端直传 OSS，就先生成预签名上传地址。</p>
              <p>3. 外部上传成功后，再点击“回写预签名上传”登记版本元数据。</p>
              <p>4. 上传完成后，返回对象列表检查版本与预签名下载是否正常。</p>
            </div>
          </section>
        </div>
      </div>
    </SystemWorkspace>
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
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function trimMiddle(value: string, maxLength: number) {
  if (!value || value.length <= maxLength || maxLength < 8) {
    return value;
  }
  const head = Math.ceil((maxLength - 3) / 2);
  const tail = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
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


function OverviewPill(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <div className="rounded-full border border-[var(--outline)]/15 bg-white px-2.5 py-1 text-[10px] font-black text-[var(--foreground)]/70">
      <span className="text-[var(--foreground)]/45">{label}:</span> <span className="text-[var(--foreground)]/80">{value}</span>
    </div>
  );
}

function MetricPill(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/40">{label}</p>
      <p className={`mt-0.5 text-xs font-black text-[var(--foreground)] ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function ObjectInfoCell(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-xl border border-[var(--outline)]/10 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/40">{label}</p>
      <p className={`mt-0.5 text-xs font-bold text-[var(--foreground)]/70 ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState(props: { title: string; description: string; compact?: boolean }) {
  const { title, description, compact = false } = props;
  return (
    <div
      className={[
        "rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] text-center text-[var(--foreground)]/60",
        compact ? "px-3 py-3" : "px-4 py-5",
      ].join(" ")}
    >
      <p className="text-xs font-black text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-[10px] font-bold leading-4">{description}</p>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15";

function TextField(props: { label?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span> : null}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

function TextAreaField(props: { label?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span> : null}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15" />
    </label>
  );
}

function SelectField(props: { label?: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  const { label, value, onChange, options } = props;
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-xs font-black text-[var(--foreground)]/72">{label}</span> : null}
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
