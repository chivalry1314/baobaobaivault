"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="dream-panel px-6 py-6 sm:px-8">
          <div className="grid gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <form className="grid gap-4 md:grid-cols-[0.95fr_1.05fr_auto]" onSubmit={handleFilterSubmit}>
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
              <TextField label="对象前缀" value={prefix} onChange={setPrefix} placeholder="例如：share/images/" />
              <button
                type="submit"
                disabled={!selectedNamespaceID || loadingObjects}
                className="btn-primary h-[50px] rounded-full px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingObjects ? "查询中..." : "查询对象"}
              </button>
            </form>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-sm font-bold text-[var(--foreground)]/65">
                {selectedNamespace
                  ? `当前命名空间：${selectedNamespace.name}，第 ${objectPage} / ${objectTotalPages} 页，共 ${objectTotal} 条`
                  : "请先选择命名空间"}
              </div>
              <Link href="/system/objects/new" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black">
                上传对象
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {!selectedNamespaceID ? (
              <p className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
                请先创建并选择命名空间。
              </p>
            ) : loadingObjects ? (
              <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载对象列表...</p>
            ) : objects.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
                <p>当前筛选条件下暂无对象。</p>
                <Link href="/system/objects/new" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                  去上传对象
                </Link>
              </div>
            ) : (
              objects.map((item) => (
                <article key={item.id} className="dream-panel-soft rounded-[22px] px-4 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-all text-base font-black text-[var(--foreground)]">{item.key}</h2>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                          {formatBytes(item.size)}
                        </span>
                        {item.version_id ? (
                          <span className="rounded-full bg-[rgba(232,241,255,0.95)] px-3 py-1 text-xs font-black text-[#35598f]">
                            版本 {item.version_id}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-bold text-[var(--foreground)]/68">文件名：{item.name || "-"}</p>
                      <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]/68">Content-Type：{item.content_type || "-"}</p>
                      <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]/68">ETag：{item.etag || "-"}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">更新时间：{formatDateTime(item.last_modified || item.updated_at)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => void handleDownload(item)} className="btn-subtle rounded-full px-4 py-2 text-sm font-black">
                        下载
                      </button>
                      <button type="button" onClick={() => void handleViewVersions(item)} className="btn-subtle rounded-full px-4 py-2 text-sm font-black">
                        版本
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePresignGet(item)}
                        disabled={presigningKey === item.key}
                        className="btn-subtle rounded-full px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {presigningKey === item.key ? "生成中..." : "预签名下载"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={deletingKey === item.key}
                        className="rounded-full bg-[#c94c3b] px-4 py-2 text-sm font-black text-white transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingKey === item.key ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <PaginationControls page={objectPage} totalPages={objectTotalPages} onPageChange={(nextPage) => void handleObjectPageChange(nextPage)} className="mt-6" />
        </section>

        <div className="flex flex-col gap-6">
          <section className="dream-panel px-6 py-6 sm:px-8">
            <h2 className="text-xl font-black text-[var(--foreground)]">对象版本</h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              {selectedObjectKey
                ? `当前对象：${selectedObjectKey}，第 ${versionPage} / ${versionTotalPages} 页，共 ${versionTotal} 条版本`
                : "请先在左侧选择一个对象查看版本"}
            </p>

            <div className="mt-5 space-y-3">
              {selectedObjectKey ? (
                loadingVersions ? (
                  <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载版本...</p>
                ) : versions.length === 0 ? (
                  <p className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-4 text-sm font-bold text-[var(--foreground)]/65">
                    暂无版本记录。
                  </p>
                ) : (
                  versions.map((version) => (
                    <article key={version.id} className="dream-panel-soft rounded-[20px] px-4 py-3.5">
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                            {version.version_id}
                          </span>
                          <span className="text-xs font-bold text-[var(--foreground)]/62">{formatBytes(version.size)}</span>
                          {version.is_latest ? (
                            <span className="rounded-full bg-[rgba(199,244,214,0.9)] px-3 py-1 text-xs font-black text-[#2f6d37]">
                              当前版本
                            </span>
                          ) : null}
                        </div>
                        <p className="break-all text-xs font-bold leading-5 text-[var(--foreground)]/68">ETag：{version.etag || "-"}</p>
                        <p className="text-xs font-bold leading-5 text-[var(--foreground)]/68">创建时间：{formatDateTime(version.created_at)}</p>
                        <button
                          type="button"
                          onClick={() => void handleRollback(version.version_id)}
                          disabled={version.is_latest || rollingBackVersionID === version.version_id}
                          className="btn-subtle w-full rounded-full px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rollingBackVersionID === version.version_id
                            ? "回滚中..."
                            : version.is_latest
                              ? "当前版本"
                              : "回滚到此版本"}
                        </button>
                      </div>
                    </article>
                  ))
                )
              ) : null}
            </div>

            <PaginationControls page={versionPage} totalPages={versionTotalPages} onPageChange={(nextPage) => void handleVersionPageChange(nextPage)} className="mt-5" />
          </section>

          <section className="dream-panel px-6 py-6 sm:px-8">
            <h2 className="text-xl font-black text-[var(--foreground)]">预签名下载地址</h2>
            {presignGetUrl ? (
              <div className="mt-4 rounded-[24px] bg-white/70 px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/75">
                <p className="break-all">{presignGetUrl}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold text-[var(--foreground)]/65">
                点击左侧对象卡片中的“预签名下载”后，这里会显示一个 300 秒有效的下载地址。
              </p>
            )}
          </section>
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

      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">上传表单</h2>
          <Link href="/system/objects" className="btn-subtle inline-flex rounded-full px-4 py-2 text-sm font-black">
            返回列表
          </Link>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleUpload}>
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

          <TextAreaField
            label="Metadata JSON"
            value={uploadForm.metadata}
            onChange={(value) => setUploadForm((current) => ({ ...current, metadata: value }))}
            placeholder='例如：{"source":"sharefrontend"}'
          />

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">文件</span>
            <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className="dream-input w-full px-4 py-3" />
          </label>

          <button
            type="submit"
            disabled={!selectedNamespaceID || uploading}
            className="btn-primary w-full rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "上传中..." : "直接上传"}
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
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

          {presignPutInfo ? (
            <div className="rounded-[24px] bg-white/70 px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/75">
              <p>对象 Key：{presignPutInfo.key}</p>
              <p className="break-all">版本号：{presignPutInfo.version_id}</p>
              <p className="mt-2 break-all">上传地址：{presignPutInfo.url}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/system/objects" className="btn-subtle inline-flex rounded-full px-6 py-3 text-sm font-black">
              返回列表
            </Link>
          </div>
        </form>
      </section>
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
