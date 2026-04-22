import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";

export default function OverviewPage({ user, tenant, refreshAll, logout, busy }) {
  const StatIcon = ({ name, color }) => {
    const LucideIcon = Icons[name];
    return LucideIcon ? <LucideIcon size={20} color={color} /> : null;
  };

  function renderProgressBar(used, max, color) {
    if (!max) return null;
    const percent = Math.min(Math.round((used / max) * 100), 100);
    return (
      <div className="progress-wrap">
        <div className="progress-info">
          <span>使用率</span>
          <span>{percent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%`, background: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid one">
      <section className="grid three">
        <Panel title="快捷入口" subtitle="常用功能快速访问">
          <div className="shortcut-grid">
            <Link to="/app/storage-objects" className="btn primary">
              <Icons.Upload size={18} />
              <span>上传对象</span>
            </Link>
            <div className="toolbar-actions">
              <button className="btn ghost" type="button" onClick={() => void refreshAll()} disabled={busy}>
                <Icons.RefreshCw size={16} className={busy ? "spin" : ""} />
                刷新
              </button>
              <button className="btn danger" type="button" onClick={logout}>
                <Icons.LogOut size={16} />
                退出
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="系统状态" subtitle="实时配额与使用情况" style={{ gridColumn: 'span 2' }}>
          <div className="grid three mini-gap">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">已用存储</span>
                <StatIcon name="HardDrive" color="var(--brand)" />
              </div>
              <div className="stat-value">{(tenant?.used_storage || 0).toLocaleString()}</div>
              {renderProgressBar(tenant?.used_storage, tenant?.max_storage, 'var(--brand)')}
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">用户数量</span>
                <StatIcon name="Users" color="var(--teal)" />
              </div>
              <div className="stat-value">{(tenant?.used_users || 0).toLocaleString()}</div>
              {renderProgressBar(tenant?.used_users, tenant?.max_users, 'var(--teal)')}
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">命名空间</span>
                <StatIcon name="Layers" color="var(--brand-2)" />
              </div>
              <div className="stat-value">{(tenant?.used_namespaces || 0).toLocaleString()}</div>
              {renderProgressBar(tenant?.used_namespaces, tenant?.max_namespaces, 'var(--brand-2)')}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid two">
        <Panel title="最近操作" subtitle="查看审计日志明细">
          <div className="audit-placeholder">
            <Icons.History size={48} color="var(--line)" />
            <p className="muted">点击下方按钮查看完整的操作审计记录</p>
            <Link className="btn ghost" to="/app/audit">
              查看审计日志
            </Link>
          </div>
        </Panel>

        <Panel title="身份中心" subtitle="管理用户与访问策略">
          <div className="mini-table">
            <div className="mini-row">
              <div className="identity-row">
                <div className="identity-icon brand">
                  <Icons.Users size={20} color="var(--brand)" />
                </div>
                <div>
                  <strong>用户管理</strong>
                  <small>添加或删除租户成员</small>
                </div>
              </div>
              <Link className="btn small ghost" to="/app/iam-users">
                管理
              </Link>
            </div>
            <div className="mini-row">
              <div className="identity-row">
                <div className="identity-icon teal">
                  <Icons.ShieldCheck size={20} color="var(--teal)" />
                </div>
                <div>
                  <strong>角色授权</strong>
                  <small>配置精细化访问控制</small>
                </div>
              </div>
              <Link className="btn small ghost" to="/app/iam-roles">
                配置
              </Link>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

