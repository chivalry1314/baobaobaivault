"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { SystemBackLink } from "@/components/share/system-back-link";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
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
  const [loading, setLoading] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [rollingBackVersionID, setRollingBackVersionID] = useState("");
  const [presigningKey, setPresigningKey] = useState("");
  const [presignGetUrl, setPresignGetUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadNamespaces();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

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
  }, [selectedNamespaceID]);

  async function loadNamespaces() {
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
  }

  async function loadObjects(namespaceID: string, nextPrefix: string, nextPage: number) {
    setLoadingObjects(true);
    setActionError("");
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
      setActionError(getShareErrorMessage(error, "加载对象列表失败，请稍后重试。"));
    } finally {
      setLoadingObjects(false);
    }
  }

  async function loadVersions(namespaceID: string, key: string, nextPage: number) {
    setLoadingVersions(true);
    setActionError("");
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
      setActionError(getShareErrorMessage(error, "加载对象版本失败，请稍后重试。"));
    } finally {
      setLoadingVersions(false);
    }
  }

  function resetActionFeedback() {
    setActionError("");
    setSuccessMessage("");
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

    const confirmed = window.confirm(`确认删除对象“${item.key}”吗？该对象的所有版本也会一起删除。`);
    if (!confirmed) {
      return;
    }

    setDeletingKey(item.key);
    resetActionFeedback();
    try {
      await shareApi.deleteSystemObject({
        namespaceID: selectedNamespaceID,
        key: item.key,
      });
      setSuccessMessage("对象已删除。");
      if (selectedObjectKey === item.key) {
        setSelectedObjectKey("");
        setVersions([]);
        setVersionPage(1);
        setVersionTotal(0);
      }
      const nextTotalPages = Math.max(1, Math.ceil(Math.max(objectTotal - 1, 0) / objectPageSize));
      await loadObjects(selectedNamespaceID, appliedPrefix, Math.min(objectPage, nextTotalPages));
    } catch (error) {
      setActionError(getShareErrorMessage(error, "删除对象失败，请稍后重试。"));
    } finally {
      setDeletingKey("");
    }
  }

  async function handleDownload(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }

    resetActionFeedback();
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
      setActionError(getShareErrorMessage(error, "下载对象失败，请稍后重试。"));
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
    resetActionFeedback();
    try {
      await shareApi.rollbackSystemObjectVersion({
        namespaceID: selectedNamespaceID,
        key: selectedObjectKey,
        versionID,
      });
      setSuccessMessage("版本回滚成功。");
      await loadObjects(selectedNamespaceID, appliedPrefix, objectPage);
      await loadVersions(selectedNamespaceID, selectedObjectKey, versionPage);
    } catch (error) {
      setActionError(getShareErrorMessage(error, "版本回滚失败，请稍后重试。"));
    } finally {
      setRollingBackVersionID("");
    }
  }

  async function handlePresignGet(item: ShareStorageObject) {
    if (!selectedNamespaceID) {
      return;
    }

    setPresigningKey(item.key);
    resetActionFeedback();
    try {
      const response = await shareApi.systemPresignGetObject({
        namespaceID: selectedNamespaceID,
        key: item.key,
        ttlSeconds: 300,
      });
      setPresignGetUrl(response.data.url);
      setSuccessMessage("预签名下载地址已生成。");
    } catch (error) {
      setActionError(getShareErrorMessage(error, "生成预签名下载地址失败，请稍后重试。"));
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
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <div className="grid gap-6">
        <section className="dream-panel overflow-hidden px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--foreground)]/40">Object Workspace</p>
              <h2 className="mt-3 text-2xl font-black text-[var(--foreground)]">对象资源工作台</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                用更紧凑的筛选栏和资源卡片来管理对象，右侧聚焦当前对象的版本与预签名下载信息。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <OverviewPill label="当前命名空间" value={selectedNamespace?.name || "未选择"} />
              <OverviewPill label="对象总数" value={selectedNamespaceID ? String(objectTotal) : "-"} />
              <OverviewPill label="当前页" value={selectedNamespaceID ? `${objectPage} / ${objectTotalPages}` : "-"} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <form
              className="grid gap-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,255,0.9))] px-5 py-5 shadow-[0_18px_48px_rgba(187,146,164,0.12)] md:grid-cols-[1.05fr_1.15fr_auto_auto]"
              onSubmit={handleFilterSubmit}
            >
              <SelectField
                label="命名空间"
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
              <TextField label="对象前缀" value={prefix} onChange={setPrefix} placeholder="例如：cards/creator-a/" />
              <button
                type="submit"
                disabled={!selectedNamespaceID || loadingObjects}
                className="btn-primary h-[50px] rounded-full px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
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
                className="btn-subtle h-[50px] rounded-full px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                重置筛选
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[24px] bg-[rgba(250,245,247,0.94)] px-4 py-3 text-sm font-bold text-[var(--foreground)]/68">
                {selectedNamespace
                  ? `当前命名空间：${selectedNamespace.name}${appliedPrefix ? ` · 前缀 ${appliedPrefix}` : ""}`
                  : "请先选择命名空间"}
              </div>
              <Link
                href="/system/objects/new"
                className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black"
              >
                上传对象
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
          <section className="dream-panel px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[rgba(220,173,187,0.35)] pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Object List</p>
                <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">对象列表</h3>
              </div>
              <p className="text-sm font-bold text-[var(--foreground)]/64">
                {selectedNamespace
                  ? `第 ${objectPage} / ${objectTotalPages} 页，共 ${objectTotal} 条`
                  : "请选择命名空间后查看对象"}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {!selectedNamespaceID ? (
                <EmptyState
                  title="还没有选择命名空间"
                  description="先在上方选择一个命名空间，系统会自动加载该空间下的对象列表。"
                />
              ) : loadingObjects ? (
                <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载对象列表...</p>
              ) : objects.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-[rgba(120,85,94,0.22)] px-5 py-6 text-sm font-bold text-[var(--foreground)]/65">
                  <p>当前筛选条件下暂无对象。</p>
                  <Link href="/system/objects/new" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
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
                        "rounded-[28px] border px-5 py-5 transition-colors duration-200",
                        isSelected
                          ? "border-[rgba(202,122,147,0.34)] bg-[rgba(255,247,249,0.96)] shadow-[0_22px_48px_rgba(195,132,154,0.16)]"
                          : "border-[rgba(220,173,187,0.24)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,255,0.9))]",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[rgba(48,77,125,0.08)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#35598f]">
                              {item.content_type?.split("/")[0] || "object"}
                            </span>
                            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                              {formatBytes(item.size)}
                            </span>
                            {item.version_id ? (
                              <span className="rounded-full bg-[rgba(232,241,255,0.95)] px-3 py-1 text-xs font-black text-[#35598f]">
                                版本 {trimMiddle(item.version_id, 18)}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-3 break-all text-lg font-black leading-8 text-[var(--foreground)]">{item.key}</h3>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <ObjectInfoCell label="文件名" value={item.name || "-"} />
                            <ObjectInfoCell label="更新时间" value={formatDateTime(item.last_modified || item.updated_at)} />
                            <ObjectInfoCell label="Content-Type" value={item.content_type || "-"} breakAll />
                            <ObjectInfoCell label="ETag" value={trimMiddle(item.etag || "-", 28)} breakAll />
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:w-[168px] xl:grid-cols-1">
                          <button
                            type="button"
                            onClick={() => void handleDownload(item)}
                            className="btn-subtle rounded-full px-4 py-2.5 text-sm font-black"
                          >
                            下载对象
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleViewVersions(item)}
                            className={[
                              "rounded-full px-4 py-2.5 text-sm font-black transition-colors",
                              isSelected
                                ? "bg-[rgba(202,122,147,0.16)] text-[var(--foreground)]"
                                : "btn-subtle",
                            ].join(" ")}
                          >
                            查看版本
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePresignGet(item)}
                            disabled={presigningKey === item.key}
                            className="btn-subtle rounded-full px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {presigningKey === item.key ? "生成中..." : "预签名下载"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingKey === item.key}
                            className="rounded-full bg-[#c94c3b] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingKey === item.key ? "删除中..." : "删除对象"}
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
              className="mt-6"
            />
          </section>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="dream-panel px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Selected Object</p>
              <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">当前对象详情</h3>
              {selectedObject ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">Object Key</p>
                    <p className="mt-2 break-all text-sm font-black leading-7 text-[var(--foreground)]">{selectedObject.key}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricPill label="文件大小" value={formatBytes(selectedObject.size)} />
                    <MetricPill label="版本数" value={String(versionTotal)} />
                    <MetricPill label="文件名" value={selectedObject.name || "-"} breakAll />
                    <MetricPill label="更新时间" value={formatDateTime(selectedObject.last_modified || selectedObject.updated_at)} />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm font-bold leading-7 text-[var(--foreground)]/65">
                  先在左侧点击“查看版本”，这里会显示当前对象摘要，并同步加载版本记录。
                </p>
              )}
            </section>

            <section className="dream-panel px-6 py-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Versions</p>
                  <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">对象版本</h3>
                </div>
                <p className="text-sm font-bold text-[var(--foreground)]/64">
                  {selectedObjectKey ? `${versionPage} / ${versionTotalPages} 页 · 共 ${versionTotal} 条` : "未选择对象"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {selectedObjectKey ? (
                  loadingVersions ? (
                    <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载版本...</p>
                  ) : versions.length === 0 ? (
                    <EmptyState title="暂无版本记录" description="这个对象目前没有可以展示的历史版本。" compact />
                  ) : (
                    versions.map((version) => (
                      <article key={version.id} className="rounded-[22px] bg-[rgba(248,252,255,0.88)] px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                            {trimMiddle(version.version_id, 18)}
                          </span>
                          <span className="text-xs font-bold text-[var(--foreground)]/62">{formatBytes(version.size)}</span>
                          {version.is_latest ? (
                            <span className="rounded-full bg-[rgba(199,244,214,0.9)] px-3 py-1 text-xs font-black text-[#2f6d37]">
                              当前版本
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 break-all text-xs font-bold leading-6 text-[var(--foreground)]/68">
                          ETag：{version.etag || "-"}
                        </p>
                        <p className="mt-1 text-xs font-bold leading-6 text-[var(--foreground)]/68">
                          创建时间：{formatDateTime(version.created_at)}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleRollback(version.version_id)}
                          disabled={version.is_latest || rollingBackVersionID === version.version_id}
                          className="btn-subtle mt-4 w-full rounded-full px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
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
                  <EmptyState title="还没有选中对象" description="左侧点击“查看版本”后，这里会加载该对象的版本列表。" compact />
                )}
              </div>

              <PaginationControls
                page={versionPage}
                totalPages={versionTotalPages}
                onPageChange={(nextPage) => void handleVersionPageChange(nextPage)}
                className="mt-5"
              />
            </section>

            <section className="dream-panel px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Presigned Link</p>
              <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">预签名下载地址</h3>
              {presignGetUrl ? (
                <div className="mt-4 rounded-[24px] bg-[rgba(255,251,245,0.9)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/75">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]/42">300 Seconds</p>
                  <p className="break-all">{presignGetUrl}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm font-bold leading-7 text-[var(--foreground)]/65">
                  在左侧对象卡片中点击“预签名下载”后，这里会显示一个 300 秒有效的下载地址。
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
  const [namespaces, setNamespaces] = useState<ShareNamespace[]>([]);
  const [selectedNamespaceID, setSelectedNamespaceID] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [presigningKey, setPresigningKey] = useState("");
  const [presignPutInfo, setPresignPutInfo] = useState<SharePreparedPresignPut | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadNamespaces();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

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

  function resetActionFeedback() {
    setActionError("");
    setSuccessMessage("");
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNamespaceID) {
      setActionError("请先选择命名空间。");
      return;
    }
    if (!uploadFile) {
      setActionError("请先选择上传文件。");
      return;
    }

    setUploading(true);
    resetActionFeedback();
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
      setSuccessMessage("对象上传成功。");
    } catch (error) {
      setActionError(getShareErrorMessage(error, "上传对象失败，请稍后重试。"));
    } finally {
      setUploading(false);
    }
  }

  async function handlePresignPut() {
    if (!selectedNamespaceID) {
      setActionError("请先选择命名空间。");
      return;
    }
    const key = uploadForm.key.trim();
    if (!key) {
      setActionError("请先填写对象 Key。");
      return;
    }

    setPresigningKey("put");
    resetActionFeedback();
    try {
      const response = await shareApi.systemPresignPutObject({
        namespaceID: selectedNamespaceID,
        key,
        ttlSeconds: 300,
      });
      setPresignPutInfo(response.data);
      setSuccessMessage("预签名上传地址已生成。");
    } catch (error) {
      setActionError(getShareErrorMessage(error, "生成预签名上传地址失败，请稍后重试。"));
    } finally {
      setPresigningKey("");
    }
  }

  async function handleCompletePresignPut() {
    if (!selectedNamespaceID || !presignPutInfo?.key || !presignPutInfo.version_id) {
      setActionError("请先生成预签名上传地址。");
      return;
    }

    let metadata: Record<string, string> | undefined;
    const rawMetadata = uploadForm.metadata.trim();
    if (rawMetadata) {
      try {
        const parsed = JSON.parse(rawMetadata) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setActionError("Metadata 必须是 JSON 对象。");
          return;
        }
        metadata = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
      } catch {
        setActionError("Metadata 不是合法的 JSON。");
        return;
      }
    }

    setPresigningKey("complete");
    resetActionFeedback();
    try {
      await shareApi.completeSystemPresignPutObject({
        namespaceID: selectedNamespaceID,
        key: presignPutInfo.key,
        versionID: presignPutInfo.version_id,
        contentType: uploadForm.contentType.trim() || undefined,
        metadata,
      });
      setSuccessMessage("预签名上传结果已回写。");
    } catch (error) {
      setActionError(getShareErrorMessage(error, "回写预签名上传结果失败，请稍后重试。"));
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
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <SystemBackLink href="/system/objects" label="返回对象列表" />

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="dream-panel overflow-hidden px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--foreground)]/40">Upload Workspace</p>
              <h2 className="mt-3 text-2xl font-black text-[var(--foreground)]">上传对象工作台</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                支持直接上传，也支持先生成预签名上传地址，再由外部客户端直传对象存储并回写结果。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <OverviewPill label="命名空间数量" value={String(namespaces.length)} />
              <OverviewPill label="当前命名空间" value={namespaces.find((item) => item.id === selectedNamespaceID)?.name || "未选择"} />
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleUpload}>
            <div className="grid gap-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,255,0.9))] px-5 py-5 shadow-[0_18px_48px_rgba(187,146,164,0.12)] md:grid-cols-2">
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
                placeholder="例如：image/png"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">文件</span>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  className="dream-input w-full px-4 py-3"
                />
              </label>

              <div className="md:col-span-2">
                <TextAreaField
                  label="Metadata JSON"
                  value={uploadForm.metadata}
                  onChange={(value) => setUploadForm((current) => ({ ...current, metadata: value }))}
                  placeholder='例如：{"source":"sharefrontend"}'
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="submit"
                disabled={!selectedNamespaceID || uploading}
                className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "上传中..." : "直接上传"}
              </button>
              <button
                type="button"
                onClick={() => void handlePresignPut()}
                disabled={!selectedNamespaceID || presigningKey === "put"}
                className="btn-subtle rounded-full px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {presigningKey === "put" ? "生成中..." : "生成预签名上传"}
              </button>
              <button
                type="button"
                onClick={() => void handleCompletePresignPut()}
                disabled={!selectedNamespaceID || presigningKey === "complete" || !presignPutInfo}
                className="btn-subtle rounded-full px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {presigningKey === "complete" ? "回写中..." : "回写预签名上传"}
              </button>
            </div>

          </form>
        </section>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="dream-panel px-6 py-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Current Draft</p>
            <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">当前上传草稿</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricPill label="命名空间" value={namespaces.find((item) => item.id === selectedNamespaceID)?.name || "未选择"} breakAll />
              <MetricPill label="对象 Key" value={uploadForm.key.trim() || uploadFile?.name || "将使用文件名"} breakAll />
              <MetricPill label="Content-Type" value={uploadForm.contentType.trim() || uploadFile?.type || "自动识别"} breakAll />
              <MetricPill label="Metadata" value={uploadForm.metadata.trim() ? "已填写" : "未填写"} />
            </div>

            <div className="mt-4 rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">Selected File</p>
              {uploadFile ? (
                <div className="mt-2 space-y-2 text-sm font-bold text-[var(--foreground)]/72">
                  <p className="break-all">{uploadFile.name}</p>
                  <p>大小：{formatBytes(uploadFile.size)}</p>
                  <p>浏览器类型：{uploadFile.type || "-"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">尚未选择文件。</p>
              )}
            </div>
          </section>

          <section className="dream-panel px-6 py-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Presigned Upload</p>
            <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">预签名上传结果</h3>
            {presignPutInfo ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[24px] bg-[rgba(255,251,245,0.9)] px-4 py-4 text-sm font-bold leading-7 text-[var(--foreground)]/72">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]/42">Object Key</p>
                  <p className="mt-1 break-all">{presignPutInfo.key}</p>
                </div>
                <div className="rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-sm font-bold leading-7 text-[var(--foreground)]/72">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]/42">Version ID</p>
                  <p className="mt-1 break-all">{presignPutInfo.version_id}</p>
                </div>
                <div className="rounded-[24px] bg-[rgba(255,255,255,0.9)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/72">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]/42">Upload URL</p>
                  <p className="break-all">{presignPutInfo.url}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold leading-7 text-[var(--foreground)]/65">
                生成预签名上传后，这里会显示对象 Key、版本号和临时上传地址。上传完成后，再点击“回写预签名上传”。
              </p>
            )}
          </section>

          <section className="dream-panel px-6 py-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/40">Workflow</p>
            <h3 className="mt-2 text-xl font-black text-[var(--foreground)]">推荐操作流程</h3>
            <div className="mt-4 space-y-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
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

function OverviewPill(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <div className="rounded-[22px] bg-[rgba(250,245,247,0.94)] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">{label}</p>
      <p className="mt-1 text-sm font-black text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function MetricPill(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-[20px] bg-[rgba(248,252,255,0.88)] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">{label}</p>
      <p className={`mt-1 text-sm font-black text-[var(--foreground)] ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function ObjectInfoCell(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-[20px] bg-white/78 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--foreground)]/42">{label}</p>
      <p className={`mt-1 text-sm font-bold text-[var(--foreground)]/72 ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState(props: { title: string; description: string; compact?: boolean }) {
  const { title, description, compact = false } = props;
  return (
    <div
      className={[
        "rounded-[26px] border border-dashed border-[rgba(120,85,94,0.22)] text-[var(--foreground)]/65",
        compact ? "px-4 py-4" : "px-5 py-6",
      ].join(" ")}
    >
      <p className="text-sm font-black text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm font-bold leading-7">{description}</p>
    </div>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="dream-input w-full px-4 py-3" />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="dream-textarea w-full px-4 py-3" />
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
