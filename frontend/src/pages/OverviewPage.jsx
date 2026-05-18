import { Link } from "react-router-dom";
import { History, KeyRound, LogOut, Mail, RefreshCw, ShieldCheck, Upload, User, Users } from "lucide-react";
import Panel from "../components/Panel";

export default function OverviewPage({ user, refreshAll, logout, busy }) {
  return (
    <div className="grid one">
      <section className="grid three">
        <Panel title="快捷入口" subtitle="常用功能快速访问">
          <div className="shortcut-grid">
            <Link to="/app/storage-objects" className="btn primary">
              <Upload size={18} />
              <span>上传对象</span>
            </Link>
            <div className="toolbar-actions">
              <button className="btn ghost" type="button" onClick={() => void refreshAll()} disabled={busy}>
                <RefreshCw size={16} className={busy ? "spin" : ""} />
                刷新
              </button>
              <button className="btn danger" type="button" onClick={logout}>
                <LogOut size={16} />
                退出
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="系统状态" subtitle="账户级运行状态" style={{ gridColumn: "span 2" }}>
          <div className="grid three mini-gap">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">当前用户</span>
                <User size={20} color="var(--brand)" />
              </div>
              <div className="stat-value">{user?.username || "-"}</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">绑定角色</span>
                <ShieldCheck size={20} color="var(--teal)" />
              </div>
              <div className="stat-value">{Array.isArray(user?.roles) ? user.roles.length : 0}</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">邮箱</span>
                <Mail size={20} color="var(--brand-2)" />
              </div>
              <div className="stat-value">{user?.email || "-"}</div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid two">
        <Panel title="最近操作" subtitle="查看审计日志明细">
          <div className="audit-placeholder">
            <History size={48} color="var(--line)" />
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
                  <Users size={20} color="var(--brand)" />
                </div>
                <div>
                  <strong>用户管理</strong>
                  <small>新增、编辑和禁用用户</small>
                </div>
              </div>
              <Link className="btn small ghost" to="/app/iam-users">
                管理
              </Link>
            </div>
            <div className="mini-row">
              <div className="identity-row">
                <div className="identity-icon teal">
                  <KeyRound size={20} color="var(--teal)" />
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
