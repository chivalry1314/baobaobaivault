"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [tenantCode, setTenantCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = tenantCode.trim().toLowerCase();
    if (!code) {
      return;
    }

    router.push(`/shop/${encodeURIComponent(code)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-16 sm:px-8">
      <section className="rounded-3xl border border-[var(--outline)] bg-white/90 p-6 shadow-[0_24px_50px_-40px_rgba(16,33,31,0.65)] fade-slide-in">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-[var(--foreground)]">
          Share 店铺入口
        </h1>
        <p className="mt-2 text-sm text-[var(--foreground)]/70">
          输入租户店铺编码进入店铺，例如：<span className="font-medium">demo</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            value={tenantCode}
            onChange={(event) => setTenantCode(event.target.value)}
            className="w-full rounded-xl border border-[var(--outline)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
            placeholder="tenant code"
          />

          <button
            type="submit"
            disabled={!tenantCode.trim()}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60"
          >
            进入店铺
          </button>
        </form>
      </section>
    </main>
  );
}
