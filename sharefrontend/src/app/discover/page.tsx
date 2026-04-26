"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { CardGrid } from "@/components/share/card-grid";
import type { DiscoverCardItem } from "@/lib/shared";
import { shareApi } from "@/lib/share-api";

export default function DiscoverPage() {
  const [cards, setCards] = useState<DiscoverCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const payload = await shareApi.discoverCards();
        if (!active) {
          return;
        }
        setCards(payload.cards);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "发现页加载失败");
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
  }, []);

  return (
    <AppShell currentPath="/discover">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]/70">Discover</p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--foreground)]">平台公开卡片</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground)]/66">
            这里展示所有公开发布的作品。卡片已经和店铺入口解耦，用户只需要平台账号即可进入创作、发布、管理自己的内容。
          </p>
        </div>

        {loading ? <div className="route-shell rounded-[32px] px-6 py-14 text-center text-[var(--foreground)]/72">发现页加载中...</div> : null}

        {!loading && error ? (
          <div className="rounded-[24px] border border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm text-[#9a3412]">{error}</div>
        ) : null}

        {!loading && !error ? <CardGrid cards={cards} /> : null}
      </section>
    </AppShell>
  );
}
