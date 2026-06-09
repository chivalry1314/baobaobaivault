"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareAuditLog } from "@/lib/shared";

const emptyFilter = {
  action: "",
  resource: "",
  status: "",
  userID: "",
  resourceID: "",
  from: "",
  to: "",
};

type AuditFilter = typeof emptyFilter;

type AuditDetail = Record<string, unknown>;

type AuditContextRow = {
  label: string;
  value: string;
  isError?: boolean;
};

type ParsedAuditRow = {
  log: ShareAuditLog;
  detail: AuditDetail;
  changes: Array<Record<string, unknown>>;
  contextRows: AuditContextRow[];
  hasSnapshots: boolean;
};

const PAGE_SIZE = 10;

export function ShareSystemAuditPage() {
  const { user, sessionChecking } = useShareSession();
  const [logs, setLogs] = useState<ShareAuditLog[]>([]);
  const [filter, setFilter] = useState<AuditFilter>(emptyFilter);
  const [appliedFilter, setAppliedFilter] = useState<AuditFilter>(emptyFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeLogID, setActiveLogID] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadLogs(emptyFilter, 1);
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  async function loadLogs(nextFilter: AuditFilter, nextPage: number) {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemAuditLogs({
        action: nextFilter.action.trim() || undefined,
        resource: nextFilter.resource.trim() || undefined,
        status: nextFilter.status.trim() || undefined,
        userID: nextFilter.userID.trim() || undefined,
        resourceID: nextFilter.resourceID.trim() || undefined,
        from: nextFilter.from.trim() || undefined,
        to: nextFilter.to.trim() || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setLogs(response.items || []);
      setAppliedFilter(nextFilter);
      setPage(response.page || nextPage);
      setPageSize(response.pageSize || PAGE_SIZE);
      setTotal(response.total || 0);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载操作审计失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    try {
      await loadLogs(filter, 1);
      setSuccessMessage("筛选条件已应用。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setSubmitting(true);
    setFilter(emptyFilter);
    setSuccessMessage("");
    try {
      await loadLogs(emptyFilter, 1);
      setSuccessMessage("筛选条件已重置。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePageChange(nextPage: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (loading || nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    setSuccessMessage("");
    await loadLogs(appliedFilter, nextPage);
  }

  const parsedRows = useMemo<ParsedAuditRow[]>(
    () =>
      logs.map((log) => {
        const detail = parseAuditDetail(log.detail);
        const changes = Array.isArray(detail.changes)
          ? (detail.changes as Array<Record<string, unknown>>)
          : [];
        const contextRows = buildAuditContextRows(log, detail);
        const hasSnapshots = Boolean(detail.before || detail.after);
        return { log, detail, changes, contextRows, hasSnapshots };
      }),
    [logs],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeAudit =
    activeLogID === null
      ? null
      : parsedRows.find(({ log }) => log.id === activeLogID) ?? null;

  if (sessionChecking) {
    return (
      <SystemLoadingPage
        currentPath="/system/audit"
        text="正在检查系统管理权限..."
      />
    );
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/audit" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/audit" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/audit"
      title="操作审计"
      description="查看系统级操作日志，支持按动作、资源、用户、时间范围筛选，方便排查问题与回溯变更。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <section className="dream-panel px-6 py-6 sm:px-8">
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={handleSubmit}
        >
          <TextField
            label="动作"
            value={filter.action}
            onChange={(value) =>
              setFilter((current) => ({ ...current, action: value }))
            }
            placeholder="例如 POST"
          />
          <TextField
            label="资源"
            value={filter.resource}
            onChange={(value) =>
              setFilter((current) => ({ ...current, resource: value }))
            }
            placeholder="例如 /api/share/me/system/objects"
          />
          <TextField
            label="状态"
            value={filter.status}
            onChange={(value) =>
              setFilter((current) => ({ ...current, status: value }))
            }
            placeholder="success / failed"
          />
          <TextField
            label="用户 ID"
            value={filter.userID}
            onChange={(value) =>
              setFilter((current) => ({ ...current, userID: value }))
            }
            placeholder="可选"
          />
          <TextField
            label="资源 ID"
            value={filter.resourceID}
            onChange={(value) =>
              setFilter((current) => ({ ...current, resourceID: value }))
            }
            placeholder="可选"
          />
          <TextField
            label="开始日期"
            value={filter.from}
            onChange={(value) =>
              setFilter((current) => ({ ...current, from: value }))
            }
            placeholder="YYYY-MM-DD"
          />
          <TextField
            label="结束日期"
            value={filter.to}
            onChange={(value) =>
              setFilter((current) => ({ ...current, to: value }))
            }
            placeholder="YYYY-MM-DD"
          />
          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "查询中..." : "应用筛选"}
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={submitting}
              className="btn-subtle rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              重置
            </button>
          </div>
        </form>
      </section>

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">
              最近日志
            </h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              第 {page} / {totalPages} 页，共 {total} 条记录
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {loading ? (
            <p className="text-sm font-bold text-[var(--foreground)]/65">
              正在加载操作审计日志...
            </p>
          ) : parsedRows.length === 0 ? (
            <p className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
              当前筛选条件下暂无操作审计日志。
            </p>
          ) : (
            parsedRows.map((row) => (
              <AuditRow
                key={row.log.id}
                row={row}
                onOpenContext={() => setActiveLogID(row.log.id)}
              />
            ))
          )}
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => void handlePageChange(nextPage)}
          className="mt-6"
        />
      </section>

      {activeAudit ? (
        <AuditContextModal
          resource={activeAudit.log.resource}
          createdAt={activeAudit.log.created_at}
          rows={activeAudit.contextRows}
          onClose={() => setActiveLogID(null)}
        />
      ) : null}
    </SystemWorkspace>
  );
}

function AuditRow({
  row,
  onOpenContext,
}: {
  row: ParsedAuditRow;
  onOpenContext: () => void;
}) {
  const { log, detail, changes, contextRows, hasSnapshots } = row;
  const detailPath = asString(detail.path);
  const httpRow = contextRows.find((item) => item.label === "HTTP");

  return (
    <article className="dream-panel-soft rounded-[18px] px-3.5 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-[var(--foreground)]/72">
              {(log.action || "-").toUpperCase()}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                log.status === "success"
                  ? "bg-[rgba(199,244,214,0.9)] text-[#2f6d37]"
                  : "bg-[rgba(255,230,224,0.9)] text-[#b64031]"
              }`}
            >
              {log.status || "unknown"}
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="break-all text-[15px] font-black leading-5 text-[var(--foreground)]">
              {log.resource || "未命名资源"}
            </h3>
            {detailPath ? (
              <p className="mt-0.5 break-all text-[12px] font-bold text-[var(--foreground)]/68">
                路径：{detailPath}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[var(--foreground)]/66">
            {httpRow ? (
              <span className="rounded-full bg-white/76 px-2.5 py-1">
                {httpRow.value}
              </span>
            ) : null}
            {log.resource_id ? (
              <span className="rounded-full bg-white/76 px-2.5 py-1">
                资源 ID：{log.resource_id}
              </span>
            ) : null}
            {log.user_id ? (
              <span className="rounded-full bg-white/76 px-2.5 py-1">
                用户 ID：{log.user_id}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5 lg:flex lg:flex-col lg:items-end lg:text-right">
          <p className="text-[11px] font-bold text-[var(--foreground)]/62">
            {formatDateTime(log.created_at)}
          </p>

          {contextRows.length > 0 ? (
            <button
              type="button"
              onClick={onOpenContext}
              className="btn-subtle rounded-full px-3 py-1.5 text-[11px] font-black text-[var(--foreground)]/74"
            >
              查看请求上下文
            </button>
          ) : null}
        </div>
      </div>

      {changes.length > 0 ? (
        <details className="mt-3 rounded-[16px] bg-white/70 px-3 py-2.5">
          <summary className="cursor-pointer text-[12px] font-black text-[var(--foreground)]">
            查看字段变更 ({changes.length})
          </summary>
          <div className="mt-2 grid gap-1.5 lg:grid-cols-2">
            {changes.map((item, index) => (
              <div
                key={`${log.id}-change-${index}`}
                className="rounded-[14px] bg-[rgba(248,242,245,0.9)] px-2.5 py-2 text-[11px] font-bold leading-5 text-[var(--foreground)]/72"
              >
                <p>字段：{String(item.field || `field_${index}`)}</p>
                <p>变更前：{formatAuditValue(item.before)}</p>
                <p>变更后：{formatAuditValue(item.after)}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {changes.length === 0 && hasSnapshots ? (
        <details className="mt-3 rounded-[16px] bg-white/70 px-3 py-2.5">
          <summary className="cursor-pointer text-[12px] font-black text-[var(--foreground)]">
            查看快照
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-[14px] bg-[rgba(248,242,245,0.9)] px-2.5 py-2 text-[11px] font-bold leading-5 text-[var(--foreground)]/72">
            {JSON.stringify(
              { before: detail.before, after: detail.after },
              null,
              2,
            )}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

function AuditContextModal({
  resource,
  createdAt,
  rows,
  onClose,
}: {
  resource?: string | null;
  createdAt?: string | null;
  rows: AuditContextRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,24,27,0.18)] p-4 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="关闭请求上下文弹窗"
        onClick={onClose}
      />
      <div className="dream-panel relative z-10 w-full max-w-[720px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-black text-[var(--foreground)]">
              请求上下文
            </h3>
            <p className="mt-1 break-all text-sm leading-6 text-[var(--foreground)]/62">
              {resource || "-"}
            </p>
            <p className="mt-1 text-[12px] font-bold text-[var(--foreground)]/52">
              {formatDateTime(createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-subtle flex h-10 w-10 items-center justify-center rounded-full text-[var(--foreground)]/62"
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5 grid gap-2.5">
          {rows.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="rounded-[16px] bg-[rgba(248,242,245,0.9)] px-3.5 py-3"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/42">
                {item.label}
              </p>
              <p
                className={`mt-1.5 break-all text-[13px] font-bold leading-6 ${
                  item.isError ? "text-[#b64031]" : "text-[var(--foreground)]/74"
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseAuditDetail(value: string): AuditDetail {
  if (!value || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as AuditDetail;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildAuditContextRows(
  log: ShareAuditLog,
  detail: AuditDetail,
): AuditContextRow[] {
  const rows: AuditContextRow[] = [];
  const method = asString(detail.method);
  const path = asString(detail.path);

  if (method || path) {
    rows.push({ label: "HTTP", value: `${method.toUpperCase()} ${path}`.trim() });
  }

  if (detail.status_code !== undefined) {
    rows.push({ label: "状态码", value: String(detail.status_code) });
  }

  if (asString(detail.auth_type)) {
    rows.push({ label: "认证方式", value: asString(detail.auth_type) });
  }

  if (log.user_id) {
    rows.push({ label: "用户 ID", value: log.user_id });
  }

  if (log.ip_address) {
    rows.push({ label: "客户端 IP", value: log.ip_address });
  }

  if (log.user_agent) {
    rows.push({ label: "User-Agent", value: log.user_agent });
  }

  if (asString(detail.error)) {
    rows.push({
      label: "错误信息",
      value: asString(detail.error),
      isError: true,
    });
  }

  return rows.filter((item) => item.value.trim());
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
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

function SystemLoadingPage({
  currentPath,
  text,
}: {
  currentPath: string;
  text: string;
}) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">
        {text}
      </div>
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
  return (
    <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">
      {message}
    </p>
  );
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <p className="dream-panel-soft border-[#d9eed6] bg-[#f3fbf1] px-5 py-4 text-sm font-bold text-[#2f6d37]">
      {message}
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="dream-input w-full px-4 py-3"
      />
    </label>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m6.53 5.47 5.47 5.47 5.47-5.47 1.06 1.06L13.06 12l5.47 5.47-1.06 1.06L12 13.06l-5.47 5.47-1.06-1.06L10.94 12 5.47 6.53l1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}
