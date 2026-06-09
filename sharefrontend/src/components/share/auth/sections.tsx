import type { AuthFormCardProps, FieldProps } from "@/components/share/auth/types";

const authText = {
  checking: "\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u72b6\u6001...",
  subtitle: "CardShare \u8d26\u53f7\u5165\u53e3",
  login: "\u767b\u5f55",
  register: "\u6ce8\u518c",
  reset: "\u627e\u56de\u5bc6\u7801",
  email: "\u90ae\u7bb1",
  nickname: "\u6635\u79f0",
  password: "\u5bc6\u7801",
  newPassword: "\u65b0\u5bc6\u7801",
  verificationCode: "\u9a8c\u8bc1\u7801",
  verificationSentPrefix: "\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001\u81f3\uff1a",
  verificationExpiresPrefix: "\u6709\u6548\u671f\u7ea6 ",
  verificationExpiresSuffix: " \u5206\u949f",
  verificationPlaceholder: "\u8bf7\u8f93\u5165 6 \u4f4d\u9a8c\u8bc1\u7801",
  verificationPlaceholderBeforeSend:
    "\u70b9\u51fb\u201c\u53d1\u9001\u9a8c\u8bc1\u7801\u201d\u540e\uff0c\u518d\u5728\u8fd9\u91cc\u8f93\u5165 6 \u4f4d\u9a8c\u8bc1\u7801",
  nicknamePlaceholder: "2-40 \u4e2a\u5b57\u7b26",
  passwordPlaceholder: "\u8bf7\u8f93\u5165\u5bc6\u7801",
  processing: "\u5904\u7406\u4e2d...",
  sendCodeSubmit: "\u53d1\u9001\u9a8c\u8bc1\u7801",
  sendResetCodeSubmit: "\u53d1\u9001\u627e\u56de\u7801",
  verifySubmit: "\u5b8c\u6210\u6ce8\u518c",
  resetConfirmSubmit: "\u786e\u8ba4\u91cd\u7f6e",
  registerSubmit: "\u7acb\u5373\u6ce8\u518c",
  loginSubmit: "\u767b\u5f55",
  hidePassword: "\u9690\u85cf\u5bc6\u7801",
  showPassword: "\u663e\u793a\u5bc6\u7801",
  backToRegister: "\u8fd4\u56de\u4fee\u6539\u6ce8\u518c\u4fe1\u606f",
  backToLogin: "\u8fd4\u56de\u767b\u5f55",
  resendCode: "\u91cd\u65b0\u53d1\u9001\u9a8c\u8bc1\u7801",
  resendPending: "\u53d1\u9001\u4e2d...",
  resendCooldownPrefix: "\u53ef\u5728 ",
  resendCooldownSuffix: " \u79d2\u540e\u91cd\u53d1",
  verificationEnabledHint:
    "\u5f53\u524d\u5df2\u542f\u7528\u90ae\u7bb1\u9a8c\u8bc1\uff0c\u8bf7\u5148\u586b\u5199\u6ce8\u518c\u4fe1\u606f\u5e76\u53d1\u9001\u9a8c\u8bc1\u7801\uff0c\u6536\u5230\u540e\u5728\u672c\u9875\u5b8c\u6210\u6ce8\u518c\u3002",
  verificationCodeReadyHint:
    "\u9a8c\u8bc1\u7801\u53d1\u9001\u540e\uff0c\u5728\u672c\u9875\u9762\u76f4\u63a5\u8f93\u5165\u5373\u53ef\u5b8c\u6210\u6ce8\u518c\u3002",
  verificationDisabledHint:
    "\u5f53\u524d\u672a\u542f\u7528\u90ae\u7bb1\u9a8c\u8bc1\uff0c\u6ce8\u518c\u6210\u529f\u540e\u4f1a\u76f4\u63a5\u767b\u5f55\u3002",
  registerHint:
    "\u6ce8\u518c\u6210\u529f\u540e\u4f1a\u81ea\u52a8\u767b\u5f55\uff1b\u5982\u679c\u540e\u7aef\u542f\u7528\u4e86\u90ae\u7bb1\u9a8c\u8bc1\uff0c\u4f1a\u5148\u5b8c\u6210\u9a8c\u8bc1\u7801\u786e\u8ba4\u3002",
  loginHint: "\u6ca1\u6709\u8d26\u53f7\u7684\u8bdd\uff0c\u53ef\u4ee5\u70b9\u51fb\u201c\u6ce8\u518c\u201d\u521b\u5efa\u65b0\u8d26\u53f7\u3002",
  resetHint: "\u8f93\u5165\u90ae\u7bb1\u540e\u53ef\u4ee5\u83b7\u53d6\u627e\u56de\u5bc6\u7801\u9a8c\u8bc1\u7801\u3002",
  resetCodeHint: "\u8bf7\u8f93\u5165\u90ae\u7bb1\u6536\u5230\u7684 6 \u4f4d\u9a8c\u8bc1\u7801\u5e76\u8bbe\u7f6e\u65b0\u5bc6\u7801\u3002",
  backHome: "\u8fd4\u56de\u9996\u9875",
} as const;

function Field({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
  autoComplete,
  trailing,
  readOnly = false,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block pl-2 text-sm font-black text-[var(--foreground)]">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full rounded-2xl border-[3px] border-[var(--outline)] py-3 pl-12 pr-12 text-base font-bold text-[var(--foreground)] transition placeholder:text-[var(--text-subtle)] ${
            readOnly ? "bg-[#eef1f5] text-[var(--foreground)]/75" : "bg-[#f8f9fa] focus:bg-[#f0f4f8]"
          }`}
          required
        />
        {trailing ? (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>
    </label>
  );
}

export function AuthCheckingCard() {
  return (
    <section className="relative z-10 w-full max-w-md rounded-[2rem] border-[4px] border-[var(--outline)] bg-white p-8 text-center text-sm font-black text-[var(--foreground)] md:p-12">
      {authText.checking}
    </section>
  );
}

export function AuthFormCard(props: AuthFormCardProps) {
  const {
    mode,
    registerStep,
    resetStep,
    emailVerificationEnabled,
    pending,
    resendPending,
    error,
    email,
    nickname,
    password,
    newPassword,
    verificationCode,
    verificationEmail,
    verificationExpiresIn,
    resendCooldownSeconds,
    showPassword,
    onSwitchMode,
    onEmailChange,
    onNicknameChange,
    onPasswordChange,
    onNewPasswordChange,
    onVerificationCodeChange,
    onTogglePassword,
  onBackToRegister,
  onBackToLogin,
  onResendVerificationCode,
  onForgotPassword,
  onSubmit,
  } = props;

  const isVerifyStep = mode === "register" && registerStep === "verify";
  const isResetVerifyStep = mode === "reset" && resetStep === "verify";
  const showRegisterFields = mode === "register";
  const showResetFields = mode === "reset";
  const usesEmailVerification = mode === "register" && emailVerificationEnabled;
  const showVerificationField = usesEmailVerification || isResetVerifyStep;
  const submitLabel = pending
    ? authText.processing
    : isVerifyStep
      ? authText.verifySubmit
      : isResetVerifyStep
        ? authText.resetConfirmSubmit
        : mode === "reset"
          ? authText.sendResetCodeSubmit
          : usesEmailVerification
            ? authText.sendCodeSubmit
            : mode === "register"
              ? authText.registerSubmit
              : authText.loginSubmit;

  return (
    <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border-[4px] border-[var(--outline)] bg-white p-8 md:p-12">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--tertiary)] opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--secondary)] opacity-60 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="mb-2 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-[var(--outline)] bg-white">
            <div className="h-10 w-10 rounded-lg border-[3px] border-[var(--outline)] bg-[linear-gradient(135deg,#cdb4f3_0%,#a2d2fb_100%)]" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--foreground)]">Dreamy</h1>
          <p className="text-sm font-extrabold text-[var(--foreground)]/80">{authText.subtitle}</p>
        </div>

        {error ? (
          <p className="mb-5 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">
            {error}
          </p>
        ) : null}

        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            label={authText.email}
            placeholder="you@example.com"
            value={email}
            onChange={onEmailChange}
            type="email"
            autoComplete="email"
            icon={<MailIcon className="h-5 w-5" />}
            readOnly={isVerifyStep}
          />

          {showRegisterFields ? (
            <Field
              label={authText.nickname}
              placeholder={authText.nicknamePlaceholder}
              value={nickname}
              onChange={onNicknameChange}
              type="text"
              autoComplete="nickname"
              icon={<UserIcon className="h-5 w-5" />}
              readOnly={isVerifyStep}
            />
          ) : null}

          {showResetFields ? (
            isResetVerifyStep ? (
              <Field
                label={authText.newPassword}
                placeholder={authText.passwordPlaceholder}
                value={newPassword}
                onChange={onNewPasswordChange}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                icon={<LockIcon className="h-5 w-5" />}
                readOnly={false}
                trailing={
                  <button
                    type="button"
                    onClick={onTogglePassword}
                    className="text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
                    aria-label={showPassword ? authText.hidePassword : authText.showPassword}
                  >
                    {showPassword ? <EyeOpenIcon className="h-5 w-5" /> : <EyeClosedIcon className="h-5 w-5" />}
                  </button>
                }
              />
            ) : null
          ) : null}

          {!showResetFields ? (
            <Field
              label={authText.password}
              placeholder={authText.passwordPlaceholder}
              value={password}
              onChange={onPasswordChange}
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              icon={<LockIcon className="h-5 w-5" />}
              readOnly={isVerifyStep}
              trailing={
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
                  aria-label={showPassword ? authText.hidePassword : authText.showPassword}
                >
                  {showPassword ? (
                    <EyeOpenIcon className="h-5 w-5" />
                  ) : (
                    <EyeClosedIcon className="h-5 w-5" />
                  )}
                </button>
              }
            />
          ) : null}

          {mode === "login" ? (
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => onSwitchMode("register")}
                className="rounded-full px-1 py-0.5 text-2xl font-black tracking-tight text-[var(--foreground)] transition hover:underline"
              >
                {authText.register}
              </button>
              {emailVerificationEnabled ? (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-base font-semibold text-[var(--foreground)]/60 transition hover:text-[var(--foreground)] hover:underline"
                >
                  {authText.reset}
                </button>
              ) : (
                <span className="text-sm font-semibold text-[var(--foreground)]/45">
                  请联系管理员重置密码
                </span>
              )}
            </div>
          ) : null}

          {mode === "reset" && !isResetVerifyStep ? (
            <p className="rounded-2xl border-[3px] border-[var(--outline)] bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[var(--foreground)]/75">
              {authText.resetHint}
            </p>
          ) : null}

          {showVerificationField ? (
            <>
              <div className="rounded-2xl border-[3px] border-[var(--outline)] bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[var(--foreground)]">
                {isVerifyStep || isResetVerifyStep ? (
                  <>
                    <p>
                      {authText.verificationSentPrefix}
                      {verificationEmail || email}
                    </p>
                    {verificationExpiresIn > 0 ? (
                      <p className="mt-1 text-[var(--foreground)]/70">
                        {authText.verificationExpiresPrefix}
                        {Math.ceil(verificationExpiresIn / 60)}
                        {authText.verificationExpiresSuffix}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[var(--foreground)]/75">
                    {mode === "reset" ? authText.resetCodeHint : authText.verificationCodeReadyHint}
                  </p>
                )}
              </div>
              <Field
                label={authText.verificationCode}
                placeholder={
                  isVerifyStep || isResetVerifyStep
                    ? authText.verificationPlaceholder
                    : authText.verificationPlaceholderBeforeSend
                }
                value={verificationCode}
                onChange={onVerificationCodeChange}
                type="text"
                autoComplete="one-time-code"
                icon={<ShieldIcon className="h-5 w-5" />}
                readOnly={!(isVerifyStep || isResetVerifyStep)}
              />
              {isVerifyStep || isResetVerifyStep ? (
                <button
                  type="button"
                  onClick={onResendVerificationCode}
                  disabled={pending || resendPending || resendCooldownSeconds > 0}
                  className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-white px-4 py-3 text-sm font-black text-[var(--foreground)] transition hover:bg-[#f6f8fa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendPending
                    ? authText.resendPending
                    : resendCooldownSeconds > 0
                      ? `${authText.resendCooldownPrefix}${resendCooldownSeconds}${authText.resendCooldownSuffix}`
                      : authText.resendCode}
                </button>
              ) : null}
            </>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[var(--button-primary)] px-5 py-3.5 text-lg font-black text-[var(--foreground)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </form>

        {isVerifyStep ? (
          <button
            type="button"
            onClick={onBackToRegister}
            disabled={pending}
            className="mt-4 w-full text-center text-sm font-bold text-[var(--foreground)]/70 transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authText.backToRegister}
          </button>
        ) : (
          <p className="mt-4 text-center text-xs font-bold text-[var(--foreground)]/65">
            {mode === "register"
              ? emailVerificationEnabled
                ? authText.verificationEnabledHint
                : authText.verificationDisabledHint
              : mode === "reset"
                ? authText.resetHint
              : authText.loginHint}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-6 text-sm font-bold text-[var(--foreground)]/70">
          {mode !== "login" ? (
            <button
              type="button"
              onClick={onBackToLogin}
              className="transition hover:text-[var(--foreground)] hover:underline"
            >
              {authText.backToLogin}
            </button>
          ) : null}
          <a href="/" className="transition hover:text-[var(--foreground)] hover:underline">
            {authText.backHome}
          </a>
        </div>
      </div>
    </section>
  );
}

export function AuthBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="sparkle-orb left-[-8%] top-[10%] h-[18rem] w-[18rem] bg-[rgba(174,231,217,0.45)]" />
      <div className="sparkle-orb right-[-10%] bottom-[-6%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.36)]" />
    </div>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M13.5 5.25 20.25 12l-6.75 6.75-1.06-1.06 4.94-4.94H3.75v-1.5h13.63l-4.94-4.94 1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 17.25V6.75Zm1.5.32v.18l6 4.62 6-4.62v-.18a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75Zm12 1.75-5.54 4.27a.75.75 0 0 1-.92 0L6 8.82v8.43c0 .41.34.75.75.75h10.5c.41 0 .75-.34.75-.75V8.82Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM6.75 19.5a5.25 5.25 0 0 1 10.5 0v.75h-1.5v-.75a3.75 3.75 0 0 0-7.5 0v.75h-1.5v-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25h-.75A2.25 2.25 0 0 0 4.5 10.5v9A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-.75V6A4.5 4.5 0 0 0 12 1.5Zm-3 6.75V6a3 3 0 1 1 6 0v2.25H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V16.5h-1.5v-2.45a1.5 1.5 0 0 1 .75-2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShieldIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 2.25c2.6 2.02 5.47 3.08 8.63 3.18v5.45c0 5.1-3.18 8.94-8.63 10.87-5.45-1.93-8.63-5.77-8.63-10.87V5.43C6.53 5.33 9.4 4.27 12 2.25Zm0 2c-2.1 1.4-4.46 2.23-7.13 2.5v4.13c0 4.18 2.48 7.26 7.13 9.05 4.65-1.79 7.13-4.87 7.13-9.05V6.75c-2.67-.27-5.03-1.1-7.13-2.5Zm-.75 4.5h1.5v4.5h-1.5v-4.5Zm0 6h1.5v1.5h-1.5v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeOpenIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 5.25c4.35 0 8.13 2.63 9.75 6.75-1.62 4.12-5.4 6.75-9.75 6.75S3.87 16.12 2.25 12C3.87 7.88 7.65 5.25 12 5.25Zm0 1.5A8.98 8.98 0 0 0 3.88 12 8.98 8.98 0 0 0 12 17.25 8.98 8.98 0 0 0 20.12 12 8.98 8.98 0 0 0 12 6.75Zm0 2.25a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeClosedIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m4.81 3.75 15.44 15.44-1.06 1.06-3.11-3.11A10.29 10.29 0 0 1 12 18.75c-4.35 0-8.13-2.63-9.75-6.75a10.74 10.74 0 0 1 3.67-4.76L3.75 4.81l1.06-1.06Zm9.98 11.04-1.55-1.55a1.5 1.5 0 0 1-2-2l-1.55-1.55A3 3 0 0 0 14.79 14.8Zm3.53.23L16 12.7c.08-.22.12-.46.12-.7a4.12 4.12 0 0 0-4.12-4.12c-.24 0-.48.04-.7.12L9.03 5.74A9.89 9.89 0 0 1 12 5.25c4.35 0 8.13 2.63 9.75 6.75a10.78 10.78 0 0 1-2.96 4.02Z"
        fill="currentColor"
      />
    </svg>
  );
}
