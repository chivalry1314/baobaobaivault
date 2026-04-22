import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";

function resolveRoleLabel(user, isPlatformAdminUser) {
  if (isPlatformAdminUser) return "平台超级管理员";
  const codes = (Array.isArray(user?.roles) ? user.roles : [])
    .map((role) => String(role?.code || "").trim())
    .filter(Boolean);
  if (codes.includes("tenant_admin")) return "租户管理员";
  if (codes.length > 0) return "租户成员";
  return "未识别角色";
}

function formatTenantLabel(item) {
  const name = String(item?.name || "").trim();
  const code = String(item?.code || "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || String(item?.id || "");
}

const Icon = ({ name, ...props }) => {
  const LucideIcon = Icons[name];
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
};

export default function DashboardLayout({
  token,
  user,
  tenant,
  navItems,
  isPlatformAdmin,
  tenantOptions,
  activeTenantID,
  onTenantSwitch,
  notice,
  setNotice,
  apiBase,
  compactNav,
  children,
}) {
  const roleLabel = resolveRoleLabel(user, isPlatformAdmin);
  const [expandedKeys, setExpandedKeys] = useState(() => {
    // 默认展开当前激活页面所在的父菜单
    return (navItems || []).filter(item => 
      item.children?.some(child => window.location.pathname === child.to)
    ).map(item => item.key);
  });

  const toggleExpand = (key) => {
    setExpandedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="app-shell">
      <div className="bg-layer" />
      <div className={`workspace ${token ? "authed" : "guest"}${compactNav ? " compact-nav" : ""}`}>
        {token ? (
          <aside className="side-nav">
            <div className="side-nav-brand">
              <div className="brand-logo">
                <Icons.Box size={20} />
              </div>
              <div className="brand-text">
                <strong>包包白存储</strong>
                <small>{tenant?.code || "DEFAULT"}</small>
              </div>
            </div>

            <nav className="side-nav-links">
              {(Array.isArray(navItems) ? navItems : []).map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedKeys.includes(item.key);

                if (hasChildren) {
                  return (
                    <div key={item.key} className="nav-group">
                      <div 
                        className={`side-link nav-group-header ${isExpanded ? "expanded" : ""}`}
                        onClick={() => toggleExpand(item.key)}
                      >
                        <div className="link-content">
                          <Icon name={item.iconName} size={18} />
                          <span>{item.label}</span>
                        </div>
                        <Icons.ChevronDown className="group-arrow" size={14} />
                      </div>
                      {isExpanded && (
                        <div className="nav-group-children">
                          {item.children.map((child) => (
                            <NavLink 
                              key={child.key} 
                              className={({ isActive }) => `side-link child-link ${isActive ? "active" : ""}`} 
                              to={child.to}
                            >
                              <Icon name={child.iconName} size={16} />
                              <span>{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink key={item.key} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`} to={item.to}>
                    <Icon name={item.iconName} size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="side-nav-footer">
              <div className="user-profile-summary">
                <div className="avatar">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="user-info">
                  <strong>{user?.username || "用户"}</strong>
                  <small>{roleLabel}</small>
                </div>
              </div>

              {isPlatformAdmin && (
                <div className="tenant-switcher" style={{ marginTop: '12px', padding: '0 8px' }}>
                  <select
                    id="tenant-switch-select"
                    value={activeTenantID || ""}
                    onChange={(event) => onTenantSwitch?.(event.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px' }}
                  >
                    {(Array.isArray(tenantOptions) ? tenantOptions : []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatTenantLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <main className="app-main">
          {notice.text ? (
            <div className={`notice ${notice.type || "info"}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {notice.type === 'success' ? <Icons.CheckCircle size={18} /> : <Icons.AlertCircle size={18} />}
                <span>{notice.text}</span>
              </div>
              <button className="btn small ghost" type="button" onClick={() => setNotice({ type: "", text: "" })}>
                <Icons.X size={14} />
              </button>
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
