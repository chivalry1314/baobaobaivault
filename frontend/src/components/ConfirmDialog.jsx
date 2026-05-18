import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  title,
  subtitle,
  changes,
  confirmText = "确认操作",
  cancelText = "取消",
  busy,
  onCancel,
  onConfirm,
  danger = false,
  kind = "info",
  note = "",
}) {
  const visualKind = danger ? "danger" : kind;
  const introIcon = danger ? <AlertTriangle size={18} /> : visualKind === "warning" ? <ShieldAlert size={18} /> : <Info size={18} />;

  return (
    <Modal open={open} title={title || "确认操作"} subtitle={subtitle} onClose={onCancel} width={480}>
      <div className={`confirm-dialog-intro ${visualKind}`}>
        <span className="confirm-dialog-icon">{introIcon}</span>
        <div className="confirm-dialog-copy">
          <strong>{danger ? "此操作不可撤销，请谨慎确认。" : "请确认是否继续执行该操作。"}</strong>
          {note ? <p>{note}</p> : null}
        </div>
      </div>

      {Array.isArray(changes) && changes.length > 0 ? (
        <div className="confirm-changes">
          {changes.map((item) => (
            <div className="confirm-change" key={item.label}>
              <code>{item.label}</code>
              <span>
                {item.beforeText} {" -> "} {item.afterText}
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
