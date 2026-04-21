import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
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
    <section className="auth-shell auth-focus-shell">
      {allowPublicRegister ? (
        <div className="auth-tabs">
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/login">
            登录
          </NavLink>
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/register">
            注册
          </NavLink>
        </div>
      ) : null}

      {isRegisterPage ? (
        <Panel title="注册租户" subtitle={registerStep === 1 ? "步骤 1/2：填写租户信息" : "步骤 2/2：设置管理员账号"}>
          <form className="form-grid" onSubmit={onBootstrap}>
            {registerStep === 1 ? (
              <>
                <label className="auth-field">
                  <span>租户名称</span>
                  <input
                    placeholder="例如：示例科技"
                    value={bootstrapForm.tenantName}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantName: e.target.value }))}
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>租户编码</span>
                  <input
                    placeholder="例如：demo_tenant"
                    value={bootstrapForm.tenantCode}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantCode: e.target.value }))}
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>租户描述</span>
                  <input
                    placeholder="可选"
                    value={bootstrapForm.tenantDescription}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, tenantDescription: e.target.value }))}
                  />
                </label>

                {registerHint ? <p className="field-hint">{registerHint}</p> : null}

                <button className="btn primary auth-submit" type="button" onClick={goNextRegisterStep} disabled={busy}>
                  下一步
                </button>
              </>
            ) : (
              <>
                <label className="auth-field">
                  <span>管理员用户名（可选）</span>
                  <input
                    placeholder="不填将根据邮箱自动生成"
                    value={bootstrapForm.adminUsername}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, adminUsername: e.target.value }))}
                  />
                </label>

                <label className="auth-field">
                  <span>管理员邮箱</span>
                  <input
                    type="email"
                    placeholder="请输入管理员邮箱"
                    value={bootstrapForm.adminEmail}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, adminEmail: e.target.value }))}
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>管理员密码</span>
                  <div className="password-wrap">
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="请输入管理员密码"
                      value={bootstrapForm.adminPassword}
                      onChange={(e) => setBootstrapForm((v) => ({ ...v, adminPassword: e.target.value }))}
                      required
                    />
                    <button className="btn ghost small" type="button" onClick={() => setShowRegisterPassword((v) => !v)}>
                      {showRegisterPassword ? "隐藏" : "显示"}
                    </button>
                  </div>
                </label>

                <label className="auth-field">
                  <span>管理员昵称</span>
                  <input
                    placeholder="可选"
                    value={bootstrapForm.adminNickname}
                    onChange={(e) => setBootstrapForm((v) => ({ ...v, adminNickname: e.target.value }))}
                  />
                </label>

                <div className="toolbar-actions auth-step-actions">
                  <button className="btn ghost" type="button" onClick={() => setRegisterStep(1)} disabled={busy}>
                    上一步
                  </button>
                  <button className="btn primary auth-submit" disabled={busy} type="submit">
                    {busy ? "提交中..." : "立即注册"}
                  </button>
                </div>
              </>
            )}
          </form>
          <p className="auth-tip">
            已有账号？<NavLink to="/login">去登录</NavLink>
          </p>
        </Panel>
      ) : (
        <Panel title="登录系统" subtitle="先输入邮箱和密码，若有多个租户再进行选择">
          <form className="form-grid" onSubmit={onLogin}>
            <label className="auth-field">
              <span>邮箱</span>
              <input
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </label>

            <label className="auth-field">
              <span>密码</span>
              <div className="password-wrap">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
                  required
                />
                <button className="btn ghost small" type="button" onClick={() => setShowLoginPassword((v) => !v)}>
                  {showLoginPassword ? "隐藏" : "显示"}
                </button>
              </div>
            </label>

            <label className="check auth-remember">
              <input type="checkbox" checked={rememberIdentity} onChange={(e) => onRememberIdentityChange(e.target.checked)} />
              记住邮箱和上次租户
            </label>

            <button className="btn secondary auth-submit" disabled={busy} type="submit">
              {busy ? "校验中..." : "下一步"}
            </button>
          </form>

          {requiresTenantSelection ? (
            <form className="form-grid auth-tenant-select" onSubmit={onConfirmTenantSelection}>
              <div className="auth-field">
                <span>选择租户</span>
                <div className="tenant-card-grid">
                  {tenantOptions.map((item) => {
                    const active = loginForm.tenantCode === item.tenantCode;
                    const isRecent = item.tenantCode === recentTenantCode;
                    return (
                      <button
                        key={item.tenantCode}
                        type="button"
                        className={`tenant-card ${active ? "active" : ""}`}
                        onClick={() => onTenantCodeChange(item.tenantCode)}
                      >
                        <div className="tenant-card-head">
                          <strong>{item.tenantName || item.tenantCode}</strong>
                          {isRecent ? <span className="tenant-badge">最近使用</span> : null}
                        </div>
                        <small>租户编码：{item.tenantCode}</small>
                        {item.username ? <small>登录账号：{item.username}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="toolbar-actions">
                <button className="btn primary" type="submit" disabled={busy || !loginForm.tenantCode}>
                  {busy ? "登录中..." : "进入租户"}
                </button>
                <button className="btn ghost" type="button" onClick={onBackToTenantDiscovery} disabled={busy}>
                  重新匹配
                </button>
              </div>
            </form>
          ) : null}

          <div className="auth-help-links">
            <button className="btn ghost small" type="button" onClick={() => setLoginHelp("请联系你所在租户管理员重置账号密码。")}>
              忘记密码
            </button>
            <button className="btn ghost small" type="button" onClick={() => setLoginHelp("若邮箱可登录多个租户，系统会在下一步让你选择。")}>
              多租户说明
            </button>
            <button className="btn ghost small" type="button" onClick={() => setLoginHelp("如无账号，请联系租户管理员开通。")}>
              联系管理员
            </button>
          </div>
          {loginHelp ? <p className="field-hint">{loginHelp}</p> : null}

          {allowPublicRegister ? (
            <p className="auth-tip">
              还没有租户？<NavLink to="/register">去注册</NavLink>
            </p>
          ) : (
            <p className="auth-tip">当前环境已关闭自助注册，如需开通请联系平台管理员。</p>
          )}
        </Panel>
      )}
    </section>
  );
}
