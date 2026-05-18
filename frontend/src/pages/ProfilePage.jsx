import Panel from "../components/Panel";

export default function ProfilePage({ user }) {
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

      <Panel title="角色信息" subtitle="当前账号权限摘要" delay={120}>
        {Array.isArray(user?.roles) && user.roles.length > 0 ? (
          <ul className="kv-list">
            {user.roles.map((role) => (
              <li key={role.id || role.code}>
                <span>{role.name || role.code || "未命名角色"}</span>
                <strong>{role.code || "-"}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">当前账号尚未绑定角色。</p>
        )}
      </Panel>
    </section>
  );
}
