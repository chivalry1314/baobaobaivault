import Panel from "../components/Panel";

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
          <button className="btn danger" type="button" onClick={logout}>
            退出登录
          </button>
        </div>
      </section>

      <section id="section-tenant" className="grid three">
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

        <Panel title="修改密码" delay={90}>
          <form className="form-grid" onSubmit={onChangePassword}>
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
            <button className="btn secondary" type="submit" disabled={busy}>
              更新密码
            </button>
          </form>
        </Panel>

        <Panel title="AK/SK 密钥" subtitle="用于服务端签名调用" delay={180}>
          <form className="form-grid" onSubmit={onCreateAksk}>
            <input
              placeholder="描述"
              value={akskForm.description}
              onChange={(e) => setAkskForm((v) => ({ ...v, description: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              placeholder="有效天数（0 表示不过期）"
              value={akskForm.expiresInDays}
              onChange={(e) => setAkskForm((v) => ({ ...v, expiresInDays: e.target.value }))}
            />
            <button className="btn secondary" type="submit" disabled={busy}>
              创建 AK/SK
            </button>
          </form>
          {lastSecret ? (
            <div className="secret-box">
              <p>密钥仅展示一次</p>
              <code>{lastSecret}</code>
            </div>
          ) : null}
          <div className="mini-table">
            {akskList.map((x) => (
              <div className="mini-row" key={x.id}>
                <div>
                  <strong>{x.access_key}</strong>
                  <small>{x.status}</small>
                </div>
                <button className="btn small danger" type="button" onClick={() => void onRevokeAksk(x.id)}>
                  吊销
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}
