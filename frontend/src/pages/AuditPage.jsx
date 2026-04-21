import Panel from "../components/Panel";

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
  return (
    <section id="section-audit" className="grid two">
      <Panel title="审计日志" subtitle={`${auditLogs.length} 条最近事件`}>
        <form className="form-grid compact" onSubmit={onApplyAuditFilter}>
          <input
            placeholder="动作（例如 GET/POST/DELETE）"
            value={auditFilter.action}
            onChange={(e) => setAuditFilter((v) => ({ ...v, action: e.target.value }))}
          />
          <input placeholder="资源" value={auditFilter.resource} onChange={(e) => setAuditFilter((v) => ({ ...v, resource: e.target.value }))} />
          <input
            placeholder="状态（例如 success/failed）"
            value={auditFilter.status}
            onChange={(e) => setAuditFilter((v) => ({ ...v, status: e.target.value }))}
          />
          <input
            placeholder="用户 ID"
            value={auditFilter.user_id}
            onChange={(e) => setAuditFilter((v) => ({ ...v, user_id: e.target.value }))}
          />
          <input
            placeholder="资源 ID"
            value={auditFilter.resource_id}
            onChange={(e) => setAuditFilter((v) => ({ ...v, resource_id: e.target.value }))}
          />
          <input
            placeholder="开始时间（RFC3339 / YYYY-MM-DD）"
            value={auditFilter.from}
            onChange={(e) => setAuditFilter((v) => ({ ...v, from: e.target.value }))}
          />
          <input
            placeholder="结束时间（RFC3339 / YYYY-MM-DD）"
            value={auditFilter.to}
            onChange={(e) => setAuditFilter((v) => ({ ...v, to: e.target.value }))}
          />
          <div className="toolbar-actions">
            <button className="btn ghost" type="submit" disabled={busy}>
              应用筛选
            </button>
            <button className="btn ghost" type="button" onClick={() => void onResetAuditFilter()} disabled={busy}>
              重置
            </button>
          </div>
        </form>

        <div className="mini-table">
          {auditLogs.map((x) => {
            const detail = parseAuditDetail(x.detail);
            const changes = Array.isArray(detail.changes) ? detail.changes : [];
            const changeCount = Number(detail.change_count) > 0 ? Number(detail.change_count) : changes.length;
            const hasSnapshots = detail.before || detail.after;
            const contextRows = buildAuditContextRows(x, detail);

            return (
              <div className="mini-row object audit-row" key={x.id}>
                <div>
                  <strong>
                    {x.action?.toUpperCase()} {x.resource}
                  </strong>
                  <small>
                    {x.status} {x.created_at}
                  </small>
                  {detail.duration_ms !== undefined ? <small>耗时: {detail.duration_ms}ms</small> : null}
                  {detail.path ? <small>路径: {detail.path}</small> : null}
                  {x.ip_address ? <small>来源 IP: {x.ip_address}</small> : null}
                  {detail.request_body_sha256 ? <small>请求体哈希: {String(detail.request_body_sha256).slice(0, 16)}...</small> : null}
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
                          <span>
                            {formatAuditValue(item.before)} {" -> "} {formatAuditValue(item.after)}
                          </span>
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
      </Panel>
    </section>
  );
}
