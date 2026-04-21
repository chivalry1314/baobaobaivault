import Panel from "../components/Panel";
import ConfirmDialog from "../components/ConfirmDialog";

function quotaRate(used, max) {
  const u = Number(used) || 0;
  const m = Number(max) || 0;
  if (m <= 0) return 0;
  return Math.min(100, Math.round((u / m) * 100));
}

function quotaTone(rate) {
  if (rate >= 90) return "danger";
  if (rate >= 75) return "warn";
  return "";
}

function QuotaBar({ label, used, max }) {
  const rate = quotaRate(used, max);
  const tone = quotaTone(rate);

  return (
    <div className="quota-bar-item">
      <div className="quota-bar-label">
        <span>{label}</span>
        <strong>
          {(Number(used) || 0).toLocaleString()} / {(Number(max) || 0).toLocaleString()} ({rate}%)
        </strong>
      </div>
      <div className="quota-bar-track">
        <div className={`quota-bar-fill${tone ? ` ${tone}` : ""}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

export default function TenantPage({
  tenant,
  busy,
  refreshAll,
  tenantForm,
  formErrors,
  hint,
  pendingChanges,
  hasPendingConfirm,
  onTenantFieldChange,
  onUpdateTenant,
  cancelPendingUpdate,
  confirmPendingUpdate,
}) {
  const hasErrors = Object.keys(formErrors || {}).length > 0;

  return (
    <>
      <section className="grid two">
        <Panel title="租户信息" subtitle="基础资料与标识">
          {tenant ? (
            <form className="form-grid" onSubmit={onUpdateTenant}>
              <input
                className={formErrors.name ? "invalid" : ""}
                placeholder="租户名称"
                value={tenantForm.name}
                onChange={(e) => onTenantFieldChange("name", e.target.value)}
                required
              />
              {formErrors.name ? <p className="field-error">{formErrors.name}</p> : null}

              <input placeholder="租户编码（只读）" value={tenant.code || ""} readOnly />

              <textarea
                className={formErrors.description ? "invalid" : ""}
                placeholder="租户描述"
                value={tenantForm.description}
                onChange={(e) => onTenantFieldChange("description", e.target.value)}
              />
              {formErrors.description ? <p className="field-error">{formErrors.description}</p> : null}

              {hasErrors ? <p className="field-error">请先修正表单错误后再保存。</p> : null}
              {hint ? <p className="field-hint">{hint}</p> : null}

              <div className="toolbar-actions">
                <button className="btn primary" type="submit" disabled={busy}>
                  保存租户信息
                </button>
                <button className="btn ghost" type="button" onClick={() => void refreshAll()} disabled={busy}>
                  刷新数据
                </button>
              </div>
            </form>
          ) : (
            <p className="muted">暂无租户信息。</p>
          )}
        </Panel>

        <Panel title="租户配额" subtitle="上限配置与使用率" delay={120}>
          {tenant ? (
            <>
              <form className="form-grid compact" onSubmit={onUpdateTenant}>
                <input
                  className={formErrors.maxStorage ? "invalid" : ""}
                  type="number"
                  min="1"
                  placeholder="最大存储字节数"
                  value={tenantForm.maxStorage}
                  onChange={(e) => onTenantFieldChange("maxStorage", e.target.value)}
                />
                {formErrors.maxStorage ? <p className="field-error">{formErrors.maxStorage}</p> : null}

                <input
                  className={formErrors.maxUsers ? "invalid" : ""}
                  type="number"
                  min="1"
                  placeholder="最大用户数"
                  value={tenantForm.maxUsers}
                  onChange={(e) => onTenantFieldChange("maxUsers", e.target.value)}
                />
                {formErrors.maxUsers ? <p className="field-error">{formErrors.maxUsers}</p> : null}

                <input
                  className={formErrors.maxNamespaces ? "invalid" : ""}
                  type="number"
                  min="1"
                  placeholder="最大命名空间数"
                  value={tenantForm.maxNamespaces}
                  onChange={(e) => onTenantFieldChange("maxNamespaces", e.target.value)}
                />
                {formErrors.maxNamespaces ? <p className="field-error">{formErrors.maxNamespaces}</p> : null}

                <input
                  className={formErrors.maxApiCalls ? "invalid" : ""}
                  type="number"
                  min="1"
                  placeholder="最大 API 调用数"
                  value={tenantForm.maxApiCalls}
                  onChange={(e) => onTenantFieldChange("maxApiCalls", e.target.value)}
                />
                {formErrors.maxApiCalls ? <p className="field-error">{formErrors.maxApiCalls}</p> : null}

                <button className="btn secondary" type="submit" disabled={busy}>
                  保存配额设置
                </button>
              </form>

              <div className="quota-bar-wrap">
                <QuotaBar label="存储" used={tenant.used_storage} max={tenant.max_storage} />
                <QuotaBar label="用户" used={tenant.used_users} max={tenant.max_users} />
                <QuotaBar label="命名空间" used={tenant.used_namespaces} max={tenant.max_namespaces} />
                <QuotaBar label="API 调用" used={tenant.used_api_calls} max={tenant.max_api_calls} />
              </div>
            </>
          ) : (
            <p className="muted">暂无租户配额信息。</p>
          )}
        </Panel>
      </section>

      <ConfirmDialog
        open={hasPendingConfirm}
        title="确认更新租户配置"
        subtitle="请核对以下变更后再提交"
        changes={pendingChanges}
        busy={busy}
        onCancel={cancelPendingUpdate}
        onConfirm={() => void confirmPendingUpdate()}
        confirmText="确认更新"
      />
    </>
  );
}
