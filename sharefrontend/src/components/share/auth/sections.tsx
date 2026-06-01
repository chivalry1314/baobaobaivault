import type { FieldProps, AuthFormCardProps } from "@/components/share/auth/types";

function Field({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
  autoComplete,
  trailing,
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
          className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-[#f8f9fa] py-3 pl-12 pr-12 text-base font-bold text-[var(--foreground)] transition placeholder:text-[var(--text-subtle)] focus:bg-[#f0f4f8]"
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
      正在检查登录状态...
    </section>
  );
}

export function AuthFormCard(props: AuthFormCardProps) {
  const {
    mode,
    pending,
    error,
    email,
    nickname,
    password,
    showPassword,
    onSwitchMode,
    onEmailChange,
    onNicknameChange,
    onPasswordChange,
    onTogglePassword,
    onSubmit,
  } = props;

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
          <p className="text-sm font-extrabold text-[var(--foreground)]/80">CardShare 账号入口</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[#f6f8fa] p-1.5">
          <button
            type="button"
            onClick={() => onSwitchMode("login")}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              mode === "login"
                ? "bg-[var(--button-primary)] text-[var(--foreground)]"
                : "text-[var(--foreground)]/70 hover:text-[var(--foreground)]"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode("register")}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              mode === "register"
                ? "bg-[var(--button-primary)] text-[var(--foreground)]"
                : "text-[var(--foreground)]/70 hover:text-[var(--foreground)]"
            }`}
          >
            注册
          </button>
        </div>

        {error ? (
          <p className="mb-5 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">
            {error}
          </p>
        ) : null}

        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            label="邮箱"
            placeholder="you@example.com"
            value={email}
            onChange={onEmailChange}
            type="email"
            autoComplete="email"
            icon={<MailIcon className="h-5 w-5" />}
          />

          {mode === "register" ? (
            <Field
              label="昵称"
              placeholder="2-40 个字符"
              value={nickname}
              onChange={onNicknameChange}
              type="text"
              autoComplete="nickname"
              icon={<UserIcon className="h-5 w-5" />}
            />
          ) : null}

          <Field
            label="密码"
            placeholder="请输入密码"
            value={password}
            onChange={onPasswordChange}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            icon={<LockIcon className="h-5 w-5" />}
            trailing={
              <button
                type="button"
                onClick={onTogglePassword}
                className="text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? (
                  <EyeOpenIcon className="h-5 w-5" />
                ) : (
                  <EyeClosedIcon className="h-5 w-5" />
                )}
              </button>
            }
          />

          <button
            type="submit"
            disabled={pending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[var(--button-primary)] px-5 py-3.5 text-lg font-black text-[var(--foreground)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "处理中..." : mode === "register" ? "立即注册" : "登录"}
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </form>

        <p className="mt-4 text-center text-xs font-bold text-[var(--foreground)]/65">
          {mode === "register"
            ? "注册成功后会自动登录，并默认成为创作者角色。"
            : "没有账号？切换到“注册”即可创建新账号。"}
        </p>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm font-bold text-[var(--foreground)]/70">
          <a href="/" className="transition hover:text-[var(--foreground)] hover:underline">
            返回首页
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
