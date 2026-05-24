"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { getShareErrorMessage, shareApi } from "@/lib/share-api";

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
      <span className="mb-2 block pl-2 text-sm font-black text-[var(--foreground)]">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground)]/55">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-[#f8f9fa] py-3 pl-12 pr-12 text-base font-bold text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground)]/40 focus:bg-[#f0f4f8]"
          required
        />
        {trailing ? <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </label>
  );
}

function getSafeRedirectPath(value: string | null, fallback: string) {
  const nextPath = (value ?? "").trim();
  if (!nextPath) {
    return fallback;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  return nextPath;
}

export function AuthPage() {
  const router = useRouter();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [redirectPath, setRedirectPath] = useState("/creator");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectPath(getSafeRedirectPath(params.get("next"), "/creator"));
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        if (session.authenticated && session.user) {
          router.replace(redirectPath);
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
  }, [redirectPath, router]);

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
      await shareApi.continueAuth({
        email: trimmedEmail,
        password,
      });

      router.push(redirectPath);
      router.refresh();
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "暂时无法继续，请稍后重试"));
    } finally {
      setPending(false);
    }
  }

  if (sessionChecking) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sparkle-orb left-[-8%] top-[10%] h-[18rem] w-[18rem] bg-[rgba(174,231,217,0.45)]" />
          <div className="sparkle-orb right-[-10%] bottom-[-6%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.36)]" />
        </div>

        <section className="relative z-10 w-full max-w-md rounded-[2rem] border-[4px] border-[var(--outline)] bg-white p-8 text-center text-sm font-black text-[var(--foreground)] md:p-12">
          正在检查登录状态...
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sparkle-orb left-[-8%] top-[10%] h-[18rem] w-[18rem] bg-[rgba(174,231,217,0.45)]" />
        <div className="sparkle-orb right-[-10%] bottom-[-6%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.36)]" />
      </div>

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border-[4px] border-[var(--outline)] bg-white p-8 md:p-12">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--tertiary)] opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--secondary)] opacity-60 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="mb-2 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-[var(--outline)] bg-white">
              <div className="h-10 w-10 rounded-lg border-[3px] border-[var(--outline)] bg-[linear-gradient(135deg,#cdb4f3_0%,#a2d2fb_100%)]" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[var(--foreground)]">Dreamy</h1>
            <p className="text-sm font-extrabold text-[var(--foreground)]/80">CardShare 账号登录</p>
          </div>

          {error ? (
            <p className="mb-5 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">{error}</p>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Field
              label="邮箱"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              icon={<MailIcon className="h-5 w-5" />}
            />

            <Field
              label="密码"
              placeholder="请输入密码"
              value={password}
              onChange={setPassword}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              icon={<LockIcon className="h-5 w-5" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-[var(--foreground)]/55 transition hover:text-[var(--foreground)]"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOpenIcon className="h-5 w-5" /> : <EyeClosedIcon className="h-5 w-5" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={pending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[var(--button-primary)] px-5 py-3.5 text-lg font-black text-[var(--foreground)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "处理中..." : "继续"}
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm font-bold text-[var(--foreground)]/70">
            <Link href="/discover" className="transition hover:underline hover:text-[var(--foreground)]">
              去发现页
            </Link>
            <span className="opacity-40">|</span>
            <Link href="/" className="transition hover:underline hover:text-[var(--foreground)]">
              返回首页
            </Link>
          </div>
        </div>
      </section>
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
