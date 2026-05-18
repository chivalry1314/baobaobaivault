import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, HelpCircle, Info, Loader2, Lock, LogIn, Mail, Rocket } from "lucide-react";

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
  onLogin
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
    const adminEmail = String(bootstrapForm.adminEmail || "").trim();
    const adminPassword = String(bootstrapForm.adminPassword || "");
    if (!adminEmail || adminPassword.length < 6) {
      setRegisterHint("请填写管理员邮箱，并保证密码长度不少于 6 位。");
      return;
    }
    setRegisterHint("");
    setRegisterStep(2);
  }

  const isRegisterPage = allowPublicRegister && authPage === "register";

  return (
    <div className="auth-shell">
      {allowPublicRegister ? (
        <div className="auth-tabs">
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/login">
            登录
          </NavLink>
          <NavLink className={({ isActive }) => `auth-tab ${isActive ? "active" : ""}`} to="/register">
            初始化管理员
          </NavLink>
        </div>
      ) : null}

      {isRegisterPage ? (
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.6)" }}>
            <h2>初始化管理员</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {registerStep === 1 ? "先填写管理员登录信息" : "再补充管理员展示信息（可选）"}
            </p>
          </div>
          <div className="card-body">
            <form className="form-grid" onSubmit={onBootstrap}>
              {registerStep === 1 ? (
                <>
                  <div className="auth-field">
                    <span>管理员邮箱</span>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      value={bootstrapForm.adminEmail}
                      onChange={(event) => setBootstrapForm((v) => ({ ...v, adminEmail: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <span>管理员密码</span>
                    <div className="password-wrap">
                      <input
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="不少于 6 位"
                        value={bootstrapForm.adminPassword}
                        onChange={(event) => setBootstrapForm((v) => ({ ...v, adminPassword: event.target.value }))}
                        required
                      />
                      <button className="password-toggle" type="button" onClick={() => setShowRegisterPassword((v) => !v)}>
                        {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {registerHint ? (
                    <div className="notice error" style={{ padding: "8px 12px", fontSize: "0.8rem" }}>
                      <AlertCircle size={14} />
                      <span>{registerHint}</span>
                    </div>
                  ) : null}

                  <button className="btn primary btn-auth" type="button" onClick={goNextRegisterStep} disabled={busy}>
                    <span>下一步</span>
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <div className="auth-field">
                    <span>管理员用户名（可选）</span>
                    <input
                      placeholder="不填则使用邮箱前缀"
                      value={bootstrapForm.adminUsername}
                      onChange={(event) => setBootstrapForm((v) => ({ ...v, adminUsername: event.target.value }))}
                    />
                  </div>

                  <div className="auth-field">
                    <span>管理员昵称（可选）</span>
                    <input
                      placeholder="例如：系统管理员"
                      value={bootstrapForm.adminNickname}
                      onChange={(event) => setBootstrapForm((v) => ({ ...v, adminNickname: event.target.value }))}
                    />
                  </div>

                  <div className="auth-field" style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn ghost" type="button" onClick={() => setRegisterStep(1)} disabled={busy} style={{ flex: 1 }}>
                        上一步
                      </button>
                      <button className="btn primary" disabled={busy} type="submit" style={{ flex: 2 }}>
                        {busy ? <Loader2 size={18} className="spin" /> : <Rocket size={18} />}
                        <span>{busy ? "正在初始化..." : "完成初始化"}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </form>
            <p className="auth-tip" style={{ marginBottom: "16px" }}>
              已有管理员账号？<NavLink to="/login">返回登录</NavLink>
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-body">
            <form className="form-grid" onSubmit={onLogin}>
              <div className="auth-field">
                <div className="auth-field-icon">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="邮箱"
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((v) => ({ ...v, email: event.target.value }))}
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-field-icon">
                  <Lock size={18} />
                </div>
                <div className="password-wrap" style={{ width: "100%" }}>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="密码"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((v) => ({ ...v, password: event.target.value }))}
                    required
                  />
                  <button className="password-toggle" type="button" onClick={() => setShowLoginPassword((v) => !v)}>
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <label className="check" style={{ cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={rememberIdentity} onChange={(event) => onRememberIdentityChange(event.target.checked)} />
                <span>记住邮箱</span>
              </label>

              <button className="btn primary btn-auth" disabled={busy} type="submit">
                {busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
                <span>{busy ? "登录中..." : "登录"}</span>
              </button>
            </form>

            <div className="auth-help-links">
              <button
                className="btn ghost small"
                type="button"
                onClick={() => setLoginHelp("若忘记密码，请联系管理员重置，或使用初始化入口重新创建首个管理员。")}
              >
                <HelpCircle size={14} />
                忘记密码
              </button>
              <button className="btn ghost small" type="button" onClick={() => setLoginHelp("建议使用企业邮箱登录，便于后续审计和找回。")}>
                <Mail size={14} />
                登录建议
              </button>
            </div>

            {loginHelp ? (
              <div className="notice success" style={{ marginTop: "12px", padding: "8px 12px", fontSize: "0.85rem" }}>
                <Info size={16} />
                <span>{loginHelp}</span>
              </div>
            ) : null}

            {!allowPublicRegister ? (
              <p className="auth-tip" style={{ fontSize: "0.75rem" }}>
                <Lock size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                公共初始化入口已关闭，请联系管理员。
              </p>
            ) : null}

            {allowPublicRegister ? (
              <p className="auth-tip" style={{ marginBottom: "16px" }}>
                尚未创建管理员？<NavLink to="/register">前往初始化</NavLink>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
