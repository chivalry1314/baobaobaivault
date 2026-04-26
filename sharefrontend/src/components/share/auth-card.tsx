"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

type AuthCardProps = {
  afterSuccess?: string;
  onSuccess?: (user: ExternalSessionUser) => void;
};

const featureList = [
  "输入邮箱和密码即可继续，首次使用会自动创建账号",
  "普通用户不需要租户码，也不需要选择店铺",
  "验证成功后直接进入创作中心",
];

export function AuthCard({ afterSuccess = "/creator", onSuccess }: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="route-shell mx-auto w-full max-w-[1080px] rounded-[36px] p-3 sm:p-5">
      <div className="grid overflow-hidden rounded-[30px] bg-white/82 md:grid-cols-[1.04fr_0.96fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,rgba(255,240,242,0.94),rgba(255,255,255,0.9),rgba(250,211,253,0.68))] px-6 py-7 sm:px-8 sm:py-8">
          <div className="absolute inset-x-8 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(120,85,94,0.36),transparent)]" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-strong)]/70">创作入口</p>
          <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-[var(--foreground)] sm:text-4xl">
            登录后开始
            <span className="block text-[var(--primary)]">创作与管理</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--foreground)]/66">
            现在 sharefrontend 使用的是平台用户模型。普通用户进入创作中心只需要一个邮箱账号。
          </p>

          <div className="mt-6 grid gap-3">
            {featureList.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-white/70 bg-white/72 px-4 py-3 text-sm leading-6 text-[var(--foreground)]/72 shadow-[0_14px_34px_-30px_rgba(120,85,94,0.48)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/90 px-6 py-7 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-md">
            <div className="inline-flex rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]/70">统一鉴权</div>
            <h3 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">继续进入创作中心</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">已有邮箱直接登录，没有账号会自动创建。</p>

            {error ? (
              <p className="mt-5 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{error}</p>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/72">邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--outline)]/78 focus:border-[var(--primary)] focus:bg-white"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/72">密码</span>
                <div className="flex items-center rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--outline)]/78"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="ml-3 text-sm text-[var(--brand-strong)] transition hover:text-[var(--primary)]"
                  >
                    {showPassword ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={pending}
                className="glass-button w-full rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "处理中..." : "继续"}
              </button>
            </form>

            <div className="mt-5 rounded-[22px] bg-[var(--surface-container-low)] px-4 py-4 text-sm leading-7 text-[var(--foreground)]/62">
              首次使用该邮箱时，默认昵称会根据邮箱前缀生成。
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--foreground)]/58">
              <Link href="/login" className="font-medium text-[var(--primary)] transition hover:text-[var(--secondary)]">
                打开完整登录页
              </Link>
              <span>或</span>
              <Link href="/discover" className="font-medium text-[var(--primary)] transition hover:text-[var(--secondary)]">
                先去发现页
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
