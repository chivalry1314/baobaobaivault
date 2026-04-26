"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { shareApi } from "@/lib/share-api";
import type { PublicCardItem, RedeemResult, ShopMeta } from "@/lib/shared";

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function formatRemaining(maxUses: number | null, usedCount: number) {
  if (maxUses === null) {
    return "不限次数";
  }

  const remaining = Math.max(maxUses - usedCount, 0);
  return `剩余 ${remaining} 次`;
}

export default function ShopClientPage({ tenantCode }: { tenantCode: string }) {
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [cards, setCards] = useState<PublicCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");

  const [codeInput, setCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RedeemResult | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadingError("");
      try {
        const [meta, browse] = await Promise.all([
          shareApi.getShopMeta(tenantCode),
          shareApi.listShopCards(tenantCode),
        ]);

        if (!active) {
          return;
        }

        setShopMeta(meta);
        setCards(browse.cards);
      } catch (loadError) {
        if (!active) {
          return;
        }
        if (loadError instanceof Error) {
          setLoadingError(loadError.message);
        } else {
          setLoadingError("加载店铺失败");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [tenantCode]);

  const normalizedPreview = useMemo(() => {
    return codeInput.toUpperCase().replace(/\s+/g, "");
  }, [codeInput]);

  async function handleRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const payload = await shareApi.redeemCode(tenantCode, codeInput);
      setResult(payload);
    } catch (redeemError) {
      setResult(null);
      if (redeemError instanceof Error) {
        setError(redeemError.message);
      } else {
        setError("校验失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">加载店铺中...</main>;
  }

  if (loadingError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-8">
        <p className="rounded-lg border border-[#f3c8ad] bg-[#fff4ec] px-3 py-2 text-sm text-[#9a3412]">
          {loadingError}
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-8">
      <div className="absolute top-10 right-0 -z-10 h-36 w-36 rounded-full bg-[var(--brand)]/10 blur-2xl" />
      <div className="absolute bottom-4 left-0 -z-10 h-44 w-44 rounded-full bg-[var(--accent)]/10 blur-2xl" />

      <header className="flex items-center justify-between rounded-2xl border border-[var(--outline)] bg-white/70 px-5 py-4 backdrop-blur-sm fade-slide-in">
        <div>
          <p className="font-[family-name:var(--font-space-grotesk)] text-xs uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            {shopMeta?.tenant.code}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--foreground)] sm:text-xl">{shopMeta?.tenant.name || "租户店铺"}</h1>
          <p className="mt-1 text-xs text-[var(--foreground)]/65">{shopMeta?.tenant.description || "店铺公开卡片与下载入口"}</p>
        </div>
        <Link
          href={`/shop/${encodeURIComponent(tenantCode)}/creator`}
          className="rounded-full border border-[var(--outline)] px-4 py-2 text-sm font-medium text-[var(--brand-strong)] transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
        >
          创作者后台
        </Link>
      </header>

      <section className="mt-7 grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <article className="rounded-3xl border border-[var(--outline)] bg-white/90 p-6 shadow-[0_24px_50px_-40px_rgba(16,33,31,0.65)] fade-slide-in" style={{ animationDelay: "120ms" }}>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold text-[var(--foreground)]">
            输入下载码
          </h2>
          <p className="mt-2 text-sm text-[var(--foreground)]/70">向店铺创作者获取下载码，输入后即可下载卡片文件。</p>

          <form onSubmit={handleRedeem} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">下载码</span>
              <input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder="例如：AB8D3KQ2"
                className="w-full rounded-xl border border-[var(--outline)] bg-[var(--panel)] px-4 py-3 font-[family-name:var(--font-space-grotesk)] text-base tracking-[0.08em] text-[var(--foreground)] outline-none transition focus:border-[var(--brand)]"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || normalizedPreview.length === 0}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "校验中..." : "验证并解锁下载"}
            </button>
          </form>

          {error ? <p className="mt-4 rounded-lg border border-[#f3c8ad] bg-[#fff4ec] px-3 py-2 text-sm text-[#9a3412]">{error}</p> : null}
        </article>

        <aside className="rounded-3xl border border-[var(--outline)] bg-[var(--panel-muted)]/80 p-6 fade-slide-in" style={{ animationDelay: "220ms" }}>
          <h3 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold text-[var(--foreground)]">当前输入</h3>
          <p className="mt-4 rounded-xl bg-white/90 px-4 py-3 font-[family-name:var(--font-space-grotesk)] text-xl tracking-[0.1em] text-[var(--brand-strong)]">
            {normalizedPreview || "—"}
          </p>
          <p className="mt-3 text-xs leading-6 text-[var(--foreground)]/70">下载码对大小写不敏感，系统会自动转换成大写进行校验。</p>
        </aside>
      </section>

      {result ? (
        <section className="mt-6 rounded-3xl border border-[var(--outline)] bg-white/95 p-6 shadow-[0_24px_50px_-40px_rgba(16,33,31,0.65)] fade-slide-in" style={{ animationDelay: "300ms" }}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--brand-strong)]">已解锁</p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{result.card.title}</h3>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">{result.card.description || "暂无描述"}</p>
            </div>

            <a
              href={result.downloadUrl}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              立即下载
            </a>
          </div>

          <dl className="mt-5 grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--panel-muted)] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/55">文件名</dt>
              <dd className="mt-1 break-all font-medium">{result.card.originalFileName}</dd>
            </div>
            <div className="rounded-xl bg-[var(--panel-muted)] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/55">文件大小</dt>
              <dd className="mt-1 font-medium">{formatBytes(result.card.size)}</dd>
            </div>
            <div className="rounded-xl bg-[var(--panel-muted)] px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/55">次数状态</dt>
              <dd className="mt-1 font-medium">{formatRemaining(result.code.maxUses, result.code.usedCount)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-[var(--outline)] bg-white/95 p-6 shadow-[0_24px_50px_-40px_rgba(16,33,31,0.65)]">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold text-[var(--foreground)]">店铺公开卡片</h2>
        {cards.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground)]/70">当前店铺暂无公开卡片。</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cards.map((item) => (
              <article key={item.card.id} className="rounded-xl border border-[var(--outline)] bg-[var(--panel)] p-4">
                <p className="text-sm font-semibold">{item.card.title}</p>
                <p className="mt-1 text-xs text-[var(--foreground)]/65">作者：{item.creator.displayName}</p>
                <p className="mt-1 text-xs text-[var(--foreground)]/65">文件：{item.card.originalFileName}</p>
                <p className="mt-1 text-xs text-[var(--foreground)]/65">下载次数：{item.stats.downloadCount}</p>
                <p className="mt-1 text-xs text-[var(--foreground)]/65">最近下载：{formatDate(item.stats.lastDownloadedAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
