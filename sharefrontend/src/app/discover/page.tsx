"use client";

import { useEffect, useMemo, useState } from "react";

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

  const showcaseStats = useMemo(() => {
    const creatorCount = new Set(cards.map((item) => item.creator.id)).size;
    const imageCount = cards.filter((item) => item.card.mimeType.startsWith("image/")).length;

    return [
      { label: "公开卡片", value: `${cards.length}` },
      { label: "创作者", value: `${creatorCount}` },
      { label: "图片卡", value: `${imageCount}` },
    ];
  }, [cards]);

  return (
    <AppShell currentPath="/discover">
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="route-shell mb-8 rounded-[34px] p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="type-overline text-[var(--primary)]/68">Discover</p>
              <h1 className="type-h1 mt-3 text-[var(--foreground)]">平台公开卡片</h1>
              <p className="type-body mt-3 max-w-2xl text-[var(--foreground)]/66">
                这里展示所有公开发布的作品。你可以直接打开详情页下载，也可以登录后进入创作中心管理自己的卡片。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {showcaseStats.map((item) => (
                <div key={item.label} className="metric-pill rounded-[20px] px-4 py-3 text-center sm:text-left lg:text-center">
                  <p className="type-meta uppercase text-[var(--foreground)]/50">{item.label}</p>
                  <p className="type-h3 mt-2 text-[var(--foreground)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="route-shell rounded-[34px] px-6 py-14 text-center text-[var(--foreground)]/72">发现页加载中...</div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[24px] border border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm text-[#9a3412]">{error}</div>
        ) : null}

        {!loading && !error ? <CardGrid cards={cards} /> : null}
      </section>
    </AppShell>
  );
}
