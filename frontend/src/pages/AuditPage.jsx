import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

function buildAuditContextRows(log, detail) {
  const rows = [];

  if (detail.method || detail.path) {
    rows.push({ label: "HTTP", value: `${String(detail.method || "").toUpperCase()} ${detail.path || ""}`.trim() });
  }
  if (detail.status_code !== undefined) {
    rows.push({ label: "状态码", value: String(detail.status_code) });
  }
  if (detail.auth_type) {
    rows.push({ label: "认证方式", value: String(detail.auth_type) });
  }
  if (log.tenant_id) {
    rows.push({ label: "租户 ID", value: String(log.tenant_id) });
  }
  if (log.user_id) {
    rows.push({ label: "用户 ID", value: String(log.user_id) });
  }
  if (log.ip_address) {
    rows.push({ label: "客户端 IP", value: String(log.ip_address) });
  }
  if (log.user_agent) {
    rows.push({ label: "User-Agent", value: String(log.user_agent) });
  }
  if (detail.error) {
    rows.push({ label: "错误信息", value: String(detail.error), isError: true });
  }

  return rows.filter((x) => x.value);
}

export default function AuditPage({
  auditLogs,
  onApplyAuditFilter,
  auditFilter,
  setAuditFilter,
  busy,
  onResetAuditFilter,
  parseAuditDetail,
  formatAuditValue,
}) {
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);

  const pagedLogs = useMemo(() => {
    return auditLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [auditLogs, page]);

  return (
    <section id="section-audit" className="grid one">
      <Panel title="审计日志" subtitle={`${auditLogs.length} 条最近事件`}>
        <div className="section-header">
          <span />
          <button className="btn small ghost" type="button" onClick={() => setShowFilter((v) => !v)}>
            <Icons.Filter size={16} />
            {showFilter ? "收起筛选" : "筛选条件"}
          </button>
        </div>

        {showFilter && (
          <form className="form-grid compact spaced-block" onSubmit={onApplyAuditFilter}>
            <div className="grid two mini-gap">
              <input placeholder="动作 (GET/POST...)" value={auditFilter.action} onChange={(e) => setAuditFilter((v) => ({ ...v, action: e.target.value }))} />
              <input placeholder="资源路径" value={auditFilter.resource} onChange={(e) => setAuditFilter((v) => ({ ...v, resource: e.target.value }))} />
            </div>
            <div className="grid two mini-gap">
              <input placeholder="状态 (success/failed)" value={auditFilter.status} onChange={(e) => setAuditFilter((v) => ({ ...v, status: e.target.value }))} />
              <input placeholder="用户 ID" value={auditFilter.user_id} onChange={(e) => setAuditFilter((v) => ({ ...v, user_id: e.target.value }))} />
            </div>
            <input placeholder="资源唯一标识 (Resource ID)" value={auditFilter.resource_id} onChange={(e) => setAuditFilter((v) => ({ ...v, resource_id: e.target.value }))} />
            <div className="grid two mini-gap">
              <input placeholder="开始时间 (YYYY-MM-DD)" value={auditFilter.from} onChange={(e) => setAuditFilter((v) => ({ ...v, from: e.target.value }))} />
              <input placeholder="结束时间 (YYYY-MM-DD)" value={auditFilter.to} onChange={(e) => setAuditFilter((v) => ({ ...v, to: e.target.value }))} />
            </div>
            <div className="toolbar-actions">
              <button className="btn primary" type="submit" disabled={busy}>
                <Icons.Search size={16} />
                <span>应用查询</span>
              </button>
              <button className="btn ghost" type="button" onClick={() => void onResetAuditFilter()} disabled={busy}>
                重置条件
              </button>
            </div>
          </form>
        )}

        {pagedLogs.length > 0 ? (
          <>
            <div className="mini-table">
              {pagedLogs.map((x) => {
                const detail = parseAuditDetail(x.detail);
                const changes = Array.isArray(detail.changes) ? detail.changes : [];
                const changeCount = Number(detail.change_count) > 0 ? Number(detail.change_count) : changes.length;
                const hasSnapshots = detail.before || detail.after;
                const contextRows = buildAuditContextRows(x, detail);

                return (
                  <div className="mini-row audit-row" key={x.id}>
                    <div>
                      <strong>{x.action?.toUpperCase()} {x.resource}</strong>
                      <div className="badge-row">
                        <span className={`badge ${x.status === 'success' ? 'success' : 'error'}`}>{x.status}</span>
                        <small>{x.created_at}</small>
                      </div>
                      {detail.duration_ms !== undefined ? <small>耗时: {detail.duration_ms}ms</small> : null}
                      {detail.path ? <small>路径: {detail.path}</small> : null}
                      {x.ip_address ? <small>来源 IP: {x.ip_address}</small> : null}
                      {changeCount > 0 ? <small>变更数: {changeCount}</small> : null}
                    </div>
                    <div className="actions-inline">
                      {x.resource_id ? <code>资源: {x.resource_id}</code> : null}
                      {x.user_id ? <code>用户: {x.user_id}</code> : null}
                    </div>

                    {changes.length > 0 ? (
                      <details className="audit-details">
                        <summary>查看变更</summary>
                        <div className="audit-changes">
                          {changes.map((item, idx) => (
                            <div className="audit-change" key={`${x.id}-chg-${idx}`}>
                              <code>{item.field || `字段_${idx}`}</code>
                              <span>{formatAuditValue(item.before)} {" -> "} {formatAuditValue(item.after)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    {changes.length === 0 && hasSnapshots ? (
                      <details className="audit-details">
                        <summary>查看快照</summary>
                        <pre className="audit-json">{JSON.stringify({ before: detail.before, after: detail.after }, null, 2)}</pre>
                      </details>
                    ) : null}

                    {contextRows.length > 0 ? (
                      <details className="audit-details">
                        <summary>查看请求上下文</summary>
                        <div className="audit-changes">
                          {contextRows.map((item) => (
                            <div className="audit-change" key={`${x.id}-ctx-${item.label}`}>
                              <code>{item.label}</code>
                              <span className={item.isError ? "audit-error-text" : ""}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Pagination total={auditLogs.length} page={page} onChange={setPage} />
          </>
        ) : (
          <div className="empty-state">
            <Icons.History size={40} />
            <p>暂无审计日志</p>
          </div>
        )}
      </Panel>
    </section>
  );
}
