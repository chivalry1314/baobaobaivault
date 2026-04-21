import { Link } from "react-router-dom";
import Panel from "../components/Panel";

export default function OverviewPage({ user, tenant, refreshAll, logout, busy }) {
  const stats = [
    { label: "已用存储", value: (tenant?.used_storage || 0).toLocaleString() },
    { label: "存储上限", value: (tenant?.max_storage || 0).toLocaleString() },
    { label: "已用用户", value: (tenant?.used_users || 0).toLocaleString() },
    { label: "用户上限", value: (tenant?.max_users || 0).toLocaleString() },
    { label: "命名空间", value: (tenant?.used_namespaces || 0).toLocaleString() },
    { label: "API 调用", value: (tenant?.used_api_calls || 0).toLocaleString() },
  ];

  return (
    <section className="grid three">
      <Panel title="欢迎回来" subtitle="控制台概览与快捷入口">
        <div className="form-grid compact">
          <strong>{user?.username || "未命名用户"}</strong>
          <small className="muted">{user?.email || "暂无邮箱"}</small>
          <div className="toolbar-actions">
            <button className="btn ghost" type="button" onClick={() => void refreshAll()} disabled={busy}>
              刷新数据
            </button>
            <button className="btn danger" type="button" onClick={logout}>
              退出登录
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="租户配额" subtitle={tenant?.code ? `租户编码：${tenant.code}` : "暂无租户信息"} delay={80}>
        {tenant ? (
          <ul className="kv-list">
            {stats.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">登录后会显示当前租户配额。</p>
        )}
      </Panel>

      <Panel title="快捷入口" subtitle="常用页面快速跳转" delay={160}>
        <div className="mini-table">
          <div className="mini-row">
            <div>
              <strong>身份权限</strong>
              <small>用户、角色、命名空间授权</small>
            </div>
            <Link className="btn small ghost" to="/app/iam">
              进入
            </Link>
          </div>
          <div className="mini-row">
            <div>
              <strong>存储对象</strong>
              <small>对象上传、下载、版本管理</small>
            </div>
            <Link className="btn small ghost" to="/app/storage">
              进入
            </Link>
          </div>
          <div className="mini-row">
            <div>
              <strong>审计日志</strong>
              <small>追踪关键操作与变更明细</small>
            </div>
            <Link className="btn small ghost" to="/app/audit">
              进入
            </Link>
          </div>
        </div>
      </Panel>
    </section>
  );
}
