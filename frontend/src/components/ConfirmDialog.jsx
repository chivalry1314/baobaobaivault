export default function ConfirmDialog({
  open,
  title,
  subtitle,
  changes,
  confirmText = "确认提交",
  cancelText = "取消",
  busy,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="dialog-mask" role="dialog" aria-modal="true">
      <section className="dialog-card">
        <header className="dialog-head">
          <h3>{title || "请确认操作"}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>

        <div className="dialog-body">
          <div className="dialog-change-list">
            {Array.isArray(changes) && changes.length > 0 ? (
              changes.map((item) => (
                <div className="dialog-change-row" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.beforeText} <code>{"→"}</code> {item.afterText}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">未检测到变更。</p>
            )}
          </div>
        </div>

        <footer className="dialog-actions">
          <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button className="btn primary" type="button" onClick={onConfirm} disabled={busy}>
            {confirmText}
          </button>
        </footer>
      </section>
    </div>
  );
}
