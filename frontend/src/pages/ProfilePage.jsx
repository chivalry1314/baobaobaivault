import Panel from "../components/Panel";

export default function ProfilePage({ user, tenant }) {
  return (
    <section className="grid two">
      <Panel title="个人资料" subtitle="当前登录用户信息">
        <ul className="kv-list">
          <li>
            <span>用户名</span>
            <strong>{user?.username || "-"}</strong>
          </li>
          <li>
            <span>邮箱</span>
            <strong>{user?.email || "-"}</strong>
          </li>
          <li>
            <span>昵称</span>
            <strong>{user?.nickname || "-"}</strong>
          </li>
          <li>
            <span>用户 ID</span>
            <code>{user?.id || "-"}</code>
          </li>
        </ul>
      </Panel>

      <Panel title="租户归属" subtitle="当前会话绑定租户" delay={120}>
        {tenant ? (
          <ul className="kv-list">
            <li>
              <span>租户名称</span>
              <strong>{tenant.name || "-"}</strong>
            </li>
            <li>
              <span>租户编码</span>
              <strong>{tenant.code || "-"}</strong>
            </li>
            <li>
              <span>租户 ID</span>
              <code>{tenant.id || "-"}</code>
            </li>
            <li>
              <span>默认存储配置</span>
              <strong>{tenant.default_storage_config_id || "未配置"}</strong>
            </li>
          </ul>
        ) : (
          <p className="muted">暂无租户信息。</p>
        )}
      </Panel>
    </section>
  );
}
