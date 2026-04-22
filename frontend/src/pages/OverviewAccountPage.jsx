import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

export default function OverviewAccountPage({
  user,
  busy,
  refreshAll,
  logout,
  tenant,
  onChangePassword,
  passwordForm,
  setPasswordForm,
  onCreateAksk,
  akskForm,
  setAkskForm,
  lastSecret,
  akskList,
  onRevokeAksk,
}) {
  const [showAkskModal, setShowAkskModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [akskPage, setAkskPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const pagedAksk = useMemo(() => {
    return akskList.slice((akskPage - 1) * PAGE_SIZE, akskPage * PAGE_SIZE);
  }, [akskList, akskPage]);

  return (
    <>
      <section id="section-account" className="toolbar">
        <div>
          <strong>{user?.username}</strong>
          <span>{user?.email}</span>
        </div>
        <div className="toolbar-actions">
          <button className="btn ghost" type="button" onClick={() => void refreshAll()} disabled={busy}>
            刷新
          </button>
          <button className="btn secondary" type="button" onClick={() => setShowPasswordModal(true)}>
            <Icons.KeyRound size={16} />
            修改密码
          </button>
          <button className="btn danger" type="button" onClick={logout}>
            退出登录
          </button>
        </div>
      </section>

      <section id="section-tenant" className="grid two">
        <Panel title="租户信息" subtitle="配额快照">
          {tenant ? (
            <ul className="kv-list">
              <li>
                <span>标识</span>
                <code>{tenant.id}</code>
              </li>
              <li>
                <span>编码</span>
                <strong>{tenant.code}</strong>
              </li>
              <li>
                <span>存储</span>
                <strong>
                  {(tenant.used_storage || 0).toLocaleString()} / {(tenant.max_storage || 0).toLocaleString()}
                </strong>
              </li>
              <li>
                <span>用户数</span>
                <strong>
                  {(tenant.used_users || 0).toLocaleString()} / {(tenant.max_users || 0).toLocaleString()}
                </strong>
              </li>
              <li>
                <span>命名空间数</span>
                <strong>
                  {(tenant.used_namespaces || 0).toLocaleString()} / {(tenant.max_namespaces || 0).toLocaleString()}
                </strong>
              </li>
              <li>
                <span>API 调用数</span>
                <strong>
                  {(tenant.used_api_calls || 0).toLocaleString()} / {(tenant.max_api_calls || 0).toLocaleString()}
                </strong>
              </li>
            </ul>
          ) : (
            <p className="muted">暂无租户信息</p>
          )}
        </Panel>

        <Panel title="AK/SK 密钥" subtitle="用于服务端签名调用" delay={180}>
          <div className="section-header">
            <span className="section-label">{akskList.length} 个密钥</span>
            <button className="btn small primary" type="button" onClick={() => setShowAkskModal(true)}>
              <Icons.Plus size={16} />
              创建密钥
            </button>
          </div>

          {lastSecret ? (
            <div className="secret-box">
              <p>密钥仅展示一次</p>
              <code>{lastSecret}</code>
            </div>
          ) : null}

          {pagedAksk.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedAksk.map((x) => (
                  <div className="mini-row" key={x.id}>
                    <div>
                      <strong>{x.access_key}</strong>
                      <div className="badge-row">
                        <span className={`badge ${x.status === 'active' ? 'success' : 'error'}`}>{x.status}</span>
                      </div>
                    </div>
                    <button className="btn small danger" type="button" onClick={() => setRevokeTarget({ id: x.id, key: x.access_key })}>
                      吊销
                    </button>
                  </div>
                ))}
              </div>
              <Pagination total={akskList.length} page={akskPage} onChange={setAkskPage} />
            </>
          ) : (
            <div className="empty-state">
              <Icons.Key size={40} />
              <p>暂无密钥，点击创建</p>
            </div>
          )}
        </Panel>
      </section>

      {/* ── 修改密码弹窗 ── */}
      <Modal open={showPasswordModal} title="修改密码" subtitle="更新当前用户登录密码" onClose={() => setShowPasswordModal(false)} width={420}>
        <form className="form-grid compact" onSubmit={(e) => { onChangePassword(e); setShowPasswordModal(false); }}>
          <input
            type="password"
            placeholder="旧密码"
            value={passwordForm.oldPassword}
            onChange={(e) => setPasswordForm((v) => ({ ...v, oldPassword: e.target.value }))}
            required
          />
          <input
            type="password"
            placeholder="新密码"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((v) => ({ ...v, newPassword: e.target.value }))}
            required
          />
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>更新密码</button>
            <button className="btn ghost" type="button" onClick={() => setShowPasswordModal(false)}>取消</button>
          </div>
        </form>
      </Modal>

      {/* ── AK/SK 创建弹窗 ── */}
      <Modal open={showAkskModal} title="创建 AK/SK 密钥" subtitle="生成新的访问密钥对" onClose={() => setShowAkskModal(false)} width={420}>
        <form className="form-grid compact" onSubmit={(e) => { onCreateAksk(e); setShowAkskModal(false); }}>
          <input placeholder="密钥用途描述" value={akskForm.description} onChange={(e) => setAkskForm((v) => ({ ...v, description: e.target.value }))} />
          <input type="number" min="0" placeholder="0 表示不过期" value={akskForm.expiresInDays} onChange={(e) => setAkskForm((v) => ({ ...v, expiresInDays: e.target.value }))} />
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>创建密钥</button>
            <button className="btn ghost" type="button" onClick={() => setShowAkskModal(false)}>取消</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="确认吊销密钥"
        subtitle={revokeTarget ? `即将吊销：${revokeTarget.key}` : ""}
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) onRevokeAksk(revokeTarget.id);
          setRevokeTarget(null);
        }}
        confirmText="确认吊销"
        cancelText="取消"
        danger
      />
    </>
  );
}
