import { NavLink } from "react-router-dom";

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

  return (
    <div className="app-shell">
      <div className="bg-layer" />
      <div className={`workspace ${token ? "authed" : "guest"}${compactNav ? " compact-nav" : ""}`}>
        {token ? (
          <aside className="side-nav">
            <div className="side-nav-brand">
              <strong>{compactNav ? "导航" : "管理导航"}</strong>
              {!compactNav && <small>{tenant?.code || "当前租户"}</small>}
            </div>

            {!compactNav ? <div className="side-nav-role">{roleLabel}</div> : null}

            <nav className="side-nav-links">
              {(Array.isArray(navItems) ? navItems : []).map((item) => (
                <NavLink key={item.key} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`} to={item.to} title={item.label}>
                  {compactNav ? item.icon : item.label}
                </NavLink>
              ))}
            </nav>

            {isPlatformAdmin && !compactNav ? (
              <div className="tenant-switcher">
                <label htmlFor="tenant-switch-select">租户视角</label>
                <select
                  id="tenant-switch-select"
                  value={activeTenantID || ""}
                  onChange={(event) => onTenantSwitch?.(event.target.value)}
                  disabled={!Array.isArray(tenantOptions) || tenantOptions.length === 0}
                >
                  {(Array.isArray(tenantOptions) ? tenantOptions : []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatTenantLabel(item)}
                    </option>
                  ))}
                </select>
                <small>切换后，列表和配置页面会加载目标租户的数据。</small>
              </div>
            ) : null}
          </aside>
        ) : null}

        <main className="app-main">
          {token ? (
            <header id="section-overview" className="hero">
              <p className="hero-kicker">云存储统一管理平台</p>
              <h1>宝宝宝云存储控制台</h1>
              <p className="hero-subtitle">面向租户、身份、命名空间、存储适配器与对象操作的一体化管理后台。</p>
              <div className="hero-meta">
                <span>接口地址: {apiBase}</span>
                <span>认证: JWT 令牌</span>
                <span>角色: {roleLabel}</span>
                {tenant ? <span>当前租户: {tenant.code || tenant.name || tenant.id}</span> : null}
              </div>
            </header>
          ) : (
            <header className="hero auth-hero">
              <p className="hero-kicker">云存储统一管理平台</p>
              <h1>欢迎登录管理控制台</h1>
              <p className="hero-subtitle">请先登录，或在首次使用时完成租户注册。</p>
            </header>
          )}

          {notice.text ? (
            <div className={`notice ${notice.type || "info"}`}>
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice({ type: "", text: "" })}>
                关闭
              </button>
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
