"use client";

import Link from "next/link";

import type { DiscoverCardItem } from "@/lib/shared";

type CardGridProps = {
  cards: DiscoverCardItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function CardGrid({
  cards,
  emptyTitle = "还没有公开卡片",
  emptyDescription = "第一个公开发布的作品会出现在这里。",
}: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="route-shell rounded-[32px] px-6 py-14 text-center">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{emptyTitle}</h2>
        <p className="mt-3 text-sm text-[var(--foreground)]/66">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((item, index) => {
        const isImage = item.card.mimeType.startsWith("image/");
        return (
          <Link
            key={item.card.id}
            href={`/cards/${encodeURIComponent(item.card.id)}`}
            className="dream-card fade-slide-in group block rounded-[30px] p-4 transition duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="overflow-hidden rounded-[24px] bg-[var(--surface-container-high)]">
              {isImage ? (
                <img
                  src={item.card.previewUrl}
                  alt={item.card.title}
                  className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#ffe8ec,#f7dce0)] text-sm text-[var(--foreground)]/68">
                  非图片卡片
                </div>
              )}
            </div>

            <div className="px-1 pb-1 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[var(--foreground)]">{item.card.title}</p>
                  <p className="mt-1 text-sm text-[var(--foreground)]/66">{item.creator.nickname}</p>
                </div>
                <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs text-[var(--brand-strong)]">
                  {item.stats.downloadCount} 次下载
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--foreground)]/72">{item.card.description || "创作者还没有补充描述。"}</p>

              <div className="mt-4 flex items-center justify-between text-xs text-[var(--foreground)]/55">
                <span>{formatBytes(item.card.size)}</span>
                <span>{item.card.originalFileName}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
