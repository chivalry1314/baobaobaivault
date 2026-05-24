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

function formatDownloads(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }

  return String(count);
}

export function CardGrid({
  cards,
  emptyTitle = "还没有公开卡片",
  emptyDescription = "第一个公开发布的作品会出现在这里。",
}: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="route-shell rounded-[34px] px-6 py-14 text-center">
        <h2 className="type-h2 text-[var(--foreground)]">{emptyTitle}</h2>
        <p className="type-body-sm mt-3 text-[var(--foreground)]/66">{emptyDescription}</p>
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
            className="dream-card card-hover-lift fade-slide-in group block rounded-[32px] p-3"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="relative overflow-hidden rounded-[24px] bg-[var(--surface-container-high)]">
              <span className="absolute left-3 top-3 z-10 rounded-full border-[3px] border-[var(--outline)] bg-white px-3 py-1 text-xs font-black text-[var(--foreground)] shadow-[0_12px_20px_-16px_rgba(120,85,94,0.44)]">
                {item.card.visibility === "public" ? "公开" : "私密"}
              </span>
              {isImage ? (
                <img
                  src={item.card.previewUrl}
                  alt={item.card.title}
                  className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#e8f4fa,#dff0f8)] text-sm text-[var(--foreground)]/68">
                  非图片卡片
                </div>
              )}
            </div>

            <div className="px-2 pb-2 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="type-h3 text-[var(--foreground)]">{item.card.title}</p>
                  <p className="type-body-sm mt-1 text-[var(--foreground)]/66">
                    {item.creator.nickname || item.creator.username || "CardShare Creator"}
                  </p>
                </div>
                <span className="rounded-full border-[3px] border-[var(--outline)] bg-[var(--accent)] px-3 py-1 text-xs font-black text-[var(--foreground)]">
                  {formatDownloads(item.stats.downloadCount)} 下载
                </span>
              </div>

              <p className="type-body-sm mt-3 line-clamp-2 text-[var(--foreground)]/72">{item.card.description || "创作者还没有补充描述。"}</p>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--foreground)]/55">
                <span className="rounded-full border-[2px] border-[var(--outline)] bg-white px-2.5 py-1">{formatBytes(item.card.size)}</span>
                <span className="truncate">{item.card.originalFileName}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
