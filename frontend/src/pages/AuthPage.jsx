import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";

export default function AuthPage({
  authPage,
  allowPublicRegister,
  busy,
  bootstrapForm,
  setBootstrapForm,
  onBootstrap,
  loginForm,
  setLoginForm,
  rememberIdentity,
  onRememberIdentityChange,
  tenantOptions,
  recentTenantCode,
  requiresTenantSelection,
  onTenantCodeChange,
  onConfirmTenantSelection,
  onBackToTenantDiscovery,
  onLogin,
}) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [registerHint, setRegisterHint] = useState("");
  const [loginHelp, setLoginHelp] = useState("");

  useEffect(() => {
    setRegisterStep(1);
    setRegisterHint("");
    setLoginHelp("");
  }, [authPage]);

  function goNextRegisterStep() {
    const tenantName = String(bootstrapForm.tenantName || "").trim();
    const tenantCode = String(bootstrapForm.tenantCode || "").trim();
    if (!tenantName || !tenantCode) {
      setRegisterHint("请先填写租户名称和租户编码。");
      return;
    }
    setRegisterHint("");
    setRegisterStep(2);
  }

  const isRegisterPage = allowPublicRegister && authPage === "register";

  return (
    <div className="auth-shell">
      {allowPublicRegister && (
        <div className="auth-tabs">
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/login">
            登录
          </NavLink>
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/register">
            注册租户
          </NavLink>
        </div>
      )}

      {isRegisterPage ? (
        <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.6)' }}>
            <h2>创建新租户</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              {registerStep === 1 ? "第一步：基础信息设置" : "第二步：管理员账户设置"}
            </p>
          </div>
          <div className="card-body">
            <form className="form-grid" onSubmit={onBootstrap}>
            {registerStep === 1 ? (
              <>
                <div className="grid two mini-gap">
                  <div className="auth-field">
                    <span>租户名称</span>
                    <input
                      placeholder="例如：包包白科技"
                      value={bootstrapForm.tenantName}
                      onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantName: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <span>租户唯一编码</span>
                    <input
                      placeholder="字母、数字、下划线"
                      value={bootstrapForm.tenantCode}
                      onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantCode: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <span>租户描述 (可选)</span>
                  <textarea
                    placeholder="简要描述该租户的用途..."
                    value={bootstrapForm.tenantDescription}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantDescription: e.target.value }))}
                  />
                </div>

                {registerHint && (
                  <div className="notice error" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                    <Icons.AlertCircle size={14} />
                    <span>{registerHint}</span>
                  </div>
                )}

                <button className="btn primary btn-auth" type="button" onClick={goNextRegisterStep} disabled={busy}>
                  <span>下一步</span>
                  <Icons.ArrowRight size={18} />
                </button>
              </>
            ) : (
              <>
                <div className="auth-field">
                  <span>管理员用户名</span>
                  <input
                    placeholder="留空将使用邮箱前缀"
                    value={bootstrapForm.adminUsername}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, adminUsername: e.target.value }))}
                  />
                </div>

                <div className="auth-field">
                  <span>管理员邮箱</span>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={bootstrapForm.adminEmail}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, adminEmail: e.target.value }))}
                    required
                  />
                </div>

                <div className="auth-field">
                  <span>管理员密码</span>
                  <div className="password-wrap">
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="设置一个安全的密码"
                      value={bootstrapForm.adminPassword}
                      onChange={(e) => setBootstrapForm((v) => ({ ...v, adminPassword: e.target.value }))}
                      required
                    />
                    <button className="password-toggle" type="button" onClick={() => setShowRegisterPassword((v) => !v)}>
                      {showRegisterPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="auth-field" style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn ghost" type="button" onClick={() => setRegisterStep(1)} disabled={busy} style={{ flex: 1 }}>
                      返回修改
                    </button>
                    <button className="btn primary" disabled={busy} type="submit" style={{ flex: 2 }}>
                      {busy ? <Icons.Loader2 size={18} className="spin" /> : <Icons.Rocket size={18} />}
                      <span>{busy ? "正在创建..." : "完成注册并初始化"}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
          <p className="auth-tip" style={{ marginBottom: '16px' }}>
            已有账号？<NavLink to="/login">返回登录</NavLink>
          </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          <div className="card-body">
            <form className="form-grid" onSubmit={onLogin}>
            <div className="auth-field">
              <div className="auth-field-icon"><Icons.Mail size={18} /></div>
              <input
                type="email"
                placeholder="邮箱地址"
                autoComplete="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </div>

            <div className="auth-field">
              <div className="auth-field-icon"><Icons.Lock size={18} /></div>
              <div className="password-wrap" style={{ width: '100%' }}>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="登录密码"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
                  required
                />
                <button className="password-toggle" type="button" onClick={() => setShowLoginPassword((v) => !v)}>
                  {showLoginPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="check" style={{ cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={rememberIdentity} onChange={(e) => onRememberIdentityChange(e.target.checked)} />
              <span>记住我的邮箱和首选租户</span>
            </label>

            <button className="btn primary btn-auth" disabled={busy} type="submit">
              {busy ? <Icons.Loader2 size={18} className="spin" /> : <Icons.LogIn size={18} />}
              <span>{busy ? "身份校验中..." : "下一步"}</span>
            </button>
          </form>

          {requiresTenantSelection && (
            <div className="auth-tenant-select" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--line)' }}>
              <div className="auth-field">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icons.Users size={16} />
                  选择要进入的租户
                </span>
                <div className="tenant-card-grid">
                  {tenantOptions.map((item) => {
                    const active = loginForm.tenantCode === item.tenantCode;
                    const isRecent = item.tenantCode === recentTenantCode;
                    return (
                      <div
                        key={item.tenantCode}
                        className={`tenant-card ${active ? "active" : ""}`}
                        onClick={() => onTenantCodeChange(item.tenantCode)}
                      >
                        {active && <div className="tenant-card-check"><Icons.Check size={14} strokeWidth={3} /></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong>{item.tenantName || item.tenantCode}</strong>
                          {isRecent && <span className="tenant-badge">最近</span>}
                        </div>
                        <small style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem' }}>{item.tenantCode}</small>
                        {item.username && (
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--brand-2)' }}>
                            <Icons.User size={10} />
                            <span>{item.username}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn ghost" type="button" onClick={onBackToTenantDiscovery} disabled={busy} style={{ flex: 1 }}>
                  重新匹配
                </button>
                <button className="btn primary" onClick={onConfirmTenantSelection} disabled={busy || !loginForm.tenantCode} style={{ flex: 2 }}>
                  {busy ? <Icons.Loader2 size={18} className="spin" /> : <Icons.ChevronRight size={18} />}
                  <span>进入控制台</span>
                </button>
              </div>
            </div>
          )}

          <div className="auth-help-links">
            <button className="btn ghost small" type="button" onClick={() => setLoginHelp("请联系所在租户的管理员，或者系统管理员。")}>
              <Icons.HelpCircle size={14} />
              忘记密码
            </button>
            <button className="btn ghost small" type="button" onClick={() => setLoginHelp("如无账号，请联系管理员分配访问权限。")}>
              <Icons.Mail size={14} />
              联系支持
            </button>
          </div>

          {loginHelp && (
            <div className="notice success" style={{ marginTop: '12px', padding: '8px 12px', fontSize: '0.85rem' }}>
              <Icons.Info size={16} />
              <span>{loginHelp}</span>
            </div>
          )}

          {!allowPublicRegister && (
            <p className="auth-tip" style={{ fontSize: '0.75rem' }}>
              <Icons.Lock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              当前环境已关闭自助注册
            </p>
          )}

          {allowPublicRegister && (
            <p className="auth-tip" style={{ marginBottom: '16px' }}>
              还没有租户？<NavLink to="/register">立即免费注册</NavLink>
            </p>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
