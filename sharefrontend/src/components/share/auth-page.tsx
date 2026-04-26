"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

type AuthPageProps = {
  afterSuccess?: string;
  onSuccess?: (user: ExternalSessionUser) => void;
};

type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  trailing?: ReactNode;
};

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
      <span className="mb-2 block pl-1 text-sm font-medium text-[var(--foreground)]/72">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--outline)]">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-3 pl-11 pr-12 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--outline)]/80 focus:border-[var(--primary)] focus:bg-white"
          required
        />
        {trailing ? <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </label>
  );
}

export function AuthPage({ afterSuccess = "/creator", onSuccess }: AuthPageProps) {
  const router = useRouter();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        if (session.authenticated && session.user) {
          onSuccess?.(session.user);
          router.replace(afterSuccess);
          router.refresh();
          return;
        }
      } catch {
        // Ignore session probing failures on the login page and fall back to the form.
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [afterSuccess, onSuccess, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("请输入邮箱地址");
      return;
    }
    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setPending(true);
    setError("");

    try {
      const payload = await shareApi.continueAuth({
        email: trimmedEmail,
        password,
      });

      onSuccess?.(payload.user);
      router.push(afterSuccess);
      router.refresh();
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "暂时无法继续，请稍后重试"));
    } finally {
      setPending(false);
    }
  }

  if (sessionChecking) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#fff7f8_0%,#fffdfb_42%,#fff4f7_100%)]">
        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl items-center justify-center px-4 py-6 sm:px-6">
          <section className="w-full max-w-[520px] rounded-[36px] border border-white/80 bg-white/90 p-6 text-center text-sm text-[var(--foreground)]/62 shadow-[0_26px_80px_-40px_rgba(120,85,94,0.42)] backdrop-blur-xl sm:p-8">
            正在检查登录状态...
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#fff7f8_0%,#fffdfb_42%,#fff4f7_100%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-10%] h-[24rem] w-[24rem] rounded-full bg-[rgba(255,209,220,0.34)] blur-[92px]" />
        <div className="absolute bottom-[-14%] right-[-10%] h-[26rem] w-[26rem] rounded-full bg-[rgba(223,187,228,0.24)] blur-[112px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl items-center justify-center px-4 py-6 sm:px-6">
        <section className="w-full max-w-[520px] rounded-[36px] border border-white/80 bg-white/90 p-6 shadow-[0_26px_80px_-40px_rgba(120,85,94,0.42)] backdrop-blur-xl sm:p-8">
          <h1 className="text-4xl font-semibold leading-none text-[var(--primary)] sm:text-5xl">CardShare</h1>

          {error ? (
            <p className="mt-5 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{error}</p>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <Field
              label="邮箱"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              icon={<MailIcon className="h-4 w-4" />}
            />

            <Field
              label="密码"
              placeholder="请输入密码"
              value={password}
              onChange={setPassword}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              icon={<LockIcon className="h-4 w-4" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-[var(--outline)] transition hover:text-[var(--primary)]"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOpenIcon className="h-4 w-4" /> : <EyeClosedIcon className="h-4 w-4" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-[linear-gradient(135deg,#f4a8bc_0%,#e6b7d9_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-18px_rgba(224,187,224,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(224,187,224,0.95)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                {pending ? "处理中..." : "继续"}
                <ArrowRightIcon className="h-4 w-4" />
              </span>
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--foreground)]/60">
            <Link href="/discover" className="font-medium text-[var(--primary)] transition hover:text-[var(--secondary)]">
              去发现页
            </Link>
            <span>·</span>
            <Link href="/" className="font-medium text-[var(--primary)] transition hover:text-[var(--secondary)]">
              返回首页
            </Link>
          </div>
        </section>
      </div>
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
