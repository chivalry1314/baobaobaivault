import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle,
  ChevronDown,
  Database,
  FileSearch,
  HardDrive,
  History,
  Key,
  Layers,
  LayoutDashboard,
  Lock,
  Settings,
  ShieldCheck,
  User,
  UserCircle,
  Users,
  X,
} from "lucide-react";

function resolveRoleLabel(user, isPlatformAdminUser) {
  if (isPlatformAdminUser) return "管理员";
  const codes = (Array.isArray(user?.roles) ? user.roles : []).map((role) => String(role?.code || "").trim());
  if (codes.length > 0) return "普通成员";
  return "未分配角色";
}

const Icon = ({ name, ...props }) => {
  const iconMap = {
    Activity,
    Database,
    FileSearch,
    HardDrive,
    History,
    Key,
    Layers,
    LayoutDashboard,
    Lock,
    Settings,
    ShieldCheck,
    User,
    UserCircle,
    Users,
  };
  const LucideIcon = iconMap[name];
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
};

export default function DashboardLayout({
  token,
  user,
  navItems,
  isPlatformAdmin,
  notice,
  setNotice,
  apiBase,
  compactNav,
  children,
}) {
  const roleLabel = resolveRoleLabel(user, isPlatformAdmin);
  const [expandedKeys, setExpandedKeys] = useState(() => {
    return (navItems || [])
      .filter((item) => item.children?.some((child) => window.location.pathname === child.to))
      .map((item) => item.key);
  });

  const toggleExpand = (key) => {
    setExpandedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="app-shell">
      <div className="bg-layer" />
      <div className={`workspace ${token ? "authed" : "guest"}${compactNav ? " compact-nav" : ""}`}>
        {token ? (
          <aside className="side-nav">
            <div className="side-nav-brand">
              <div className="brand-logo">
                <Box size={20} />
              </div>
              <div className="brand-text">
                <strong>Baobaobai Vault</strong>
                <small>To C Console</small>
              </div>
            </div>

            <nav className="side-nav-links">
              {(Array.isArray(navItems) ? navItems : []).map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedKeys.includes(item.key);

                if (hasChildren) {
                  return (
                    <div key={item.key} className="nav-group">
                      <div className={`side-link nav-group-header ${isExpanded ? "expanded" : ""}`} onClick={() => toggleExpand(item.key)}>
                        <div className="link-content">
                          <Icon name={item.iconName} size={18} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown className="group-arrow" size={14} />
                      </div>
                      {isExpanded ? (
                        <div className="nav-group-children">
                          {item.children.map((child) => (
                            <NavLink key={child.key} className={({ isActive }) => `side-link child-link ${isActive ? "active" : ""}`} to={child.to}>
                              <Icon name={child.iconName} size={16} />
                              <span>{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      ) : null}
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
                <div className="avatar">{user?.username?.charAt(0).toUpperCase() || "U"}</div>
                <div className="user-info">
                  <strong>{user?.username || "用户"}</strong>
                  <small>{roleLabel}</small>
                </div>
              </div>
              <div style={{ marginTop: 8, padding: "0 8px" }}>
                <small className="muted">API: {apiBase}</small>
              </div>
            </div>
          </aside>
        ) : null}

        <main className="app-main">
          {notice.text ? (
            <div className={`notice ${notice.type || "info"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {notice.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{notice.text}</span>
              </div>
              <button className="btn small ghost" type="button" onClick={() => setNotice({ type: "", text: "" })}>
                <X size={14} />
              </button>
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
