import * as Icons from "lucide-react";
import Modal from "./Modal";

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
  danger = false,
  kind = "info",
  note = "",
}) {
  const visualKind = danger ? "danger" : kind;
  const introIcon = danger
    ? <Icons.AlertTriangle size={18} />
    : visualKind === "warning"
      ? <Icons.ShieldAlert size={18} />
      : <Icons.Info size={18} />;

  return (
    <Modal open={open} title={title || "请确认操作"} subtitle={subtitle} onClose={onCancel} width={480}>
      <div className={`confirm-dialog-intro ${visualKind}`}>
        <span className="confirm-dialog-icon">{introIcon}</span>
        <div className="confirm-dialog-copy">
          <strong>{danger ? "此操作具有风险，请确认后继续。" : "请确认本次操作内容。"}</strong>
          {note ? <p>{note}</p> : null}
        </div>
      </div>

      {Array.isArray(changes) && changes.length > 0 ? (
        <div className="confirm-changes">
          {changes.map((item) => (
            <div className="confirm-change" key={item.label}>
              <code>{item.label}</code>
              <span>
                {item.beforeText} → {item.afterText}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="toolbar-actions">
        <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
          {cancelText}
        </button>
        <button className={`btn ${danger ? "danger" : "primary"}`} type="button" onClick={onConfirm} disabled={busy}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
