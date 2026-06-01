import type { ReactNode } from "react";

import {
  formatDate,
  getRarityLabel,
  getVisibilityLabel,
  isImageCard,
} from "@/components/share/access-code-card-picker/helpers";
import type { DashboardCard } from "@/lib/shared";

export function StepPill({
  active,
  label,
  title,
  icon,
}: {
  active: boolean;
  label: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`dream-chip flex h-11 w-11 items-center justify-center ${active ? "bg-[var(--button-rose)] text-[var(--foreground)]" : "text-[var(--foreground)]/55"}`}>{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/42">{label}</div>
        <div className={`text-base font-black ${active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/56"}`}>{title}</div>
      </div>
    </div>
  );
}

export function EmptyCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="dream-panel mt-10 px-6 py-14 text-center sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,223,231,0.92)] text-[var(--brand-strong)]">
        <CardIcon className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-3xl font-black text-[var(--foreground)]">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--foreground)]/62">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </section>
  );
}

export function CardPickerListItem({
  item,
  selected,
  onSelect,
}: {
  item: DashboardCard;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  const rarityLabel = getRarityLabel(item.stats.downloadCount);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.card.id)}
      className={`dream-panel-soft flex w-full flex-col gap-5 p-5 text-left transition sm:flex-row sm:items-center ${
        selected ? "border-[var(--brand-strong)] bg-[#fff8fb]" : "hover:-translate-y-0.5"
      }`}
    >
      <div className="relative h-[210px] w-full overflow-hidden rounded-[24px] bg-[#2d2327] sm:h-[180px] sm:w-[180px] sm:shrink-0">
        {isImageCard(item.card) ? (
          <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-lg font-black text-white/92">{item.card.title}</div>
        )}

        <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-black text-white">{rarityLabel}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[2rem] font-black leading-none text-[var(--foreground)]">{item.card.title}</div>
            <div className="mt-3 text-sm tracking-[0.08em] text-[var(--foreground)]/48">创建时间：{formatDate(item.card.createdAt)}</div>
          </div>

          <span className={`dream-chip inline-flex items-center px-4 py-2 text-sm font-black ${selected ? "bg-[#fff1f6] text-[var(--brand-strong)]" : "text-[var(--foreground)]/56"}`}>{selected ? "已选中" : "点击选择"}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--foreground)]/58">
          <span className="dream-chip px-3 py-1">{getVisibilityLabel(item.card)}</span>
          <span className="dream-chip px-3 py-1">下载 {item.stats.downloadCount}</span>
          <span className="dream-chip px-3 py-1">{item.card.originalFileName}</span>
        </div>

        <p className="mt-4 text-base leading-8 text-[var(--foreground)]/62">{item.card.description.trim() || "这张卡片还没有填写描述，进入编辑页可以补充内容。"}</p>
      </div>
    </button>
  );
}

export function CardPickerGridItem({
  item,
  selected,
  onSelect,
}: {
  item: DashboardCard;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  const rarityLabel = getRarityLabel(item.stats.downloadCount);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.card.id)}
      className={`dream-panel-soft group relative overflow-hidden p-3 text-left transition ${selected ? "border-[var(--brand-strong)] bg-[#fff8fb]" : "hover:-translate-y-1"}`}
    >
      <div className="relative overflow-hidden rounded-[26px] bg-[#2d2327]">
        {isImageCard(item.card) ? (
          <img src={item.card.previewUrl} alt={item.card.title} className="aspect-[4/5] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center px-5 text-center text-xl font-black text-white/92">{item.card.title}</div>
        )}

        <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-black text-white">{rarityLabel}</span>

        <span className={`dream-chip absolute right-4 top-4 flex h-11 w-11 items-center justify-center ${selected ? "bg-[#fff1f5] text-[var(--brand-strong)]" : "text-[#8c6772]"}`}>
          <HeartIcon className="h-5 w-5" />
        </span>

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,12,15,0)_0%,rgba(17,12,15,0.82)_100%)] px-5 pb-5 pt-16">
          <div className="inline-flex rounded-full bg-white/18 px-3 py-1 text-xs tracking-[0.08em] text-white/92">{getVisibilityLabel(item.card)}</div>
          <div className="mt-4 text-[2rem] font-black leading-none text-white">{item.card.title}</div>
        </div>

        {selected ? <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[var(--button-rose)] ring-offset-2 ring-offset-white/40" /> : null}
      </div>
    </button>
  );
}

export const AccessCodePickerIcons = {
  SparkleIcon,
  FilterIcon,
  GridIcon,
  ListIcon,
  HeartIcon,
  SettingsIcon,
  CardIcon,
  ArrowRightIcon,
  BackIcon,
} as const;

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 2 1.56 4.44L18 8l-4.44 1.56L12 14l-1.56-4.44L6 8l4.44-1.56L12 2Zm-6 12 1.04 2.96L10 18l-2.96 1.04L6 22l-1.04-2.96L2 18l2.96-1.04L6 14Zm12 1 1.04 2.96L22 19l-2.96 1.04L18 23l-1.04-2.96L14 19l2.96-1.04L18 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FilterIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 6h15v1.5h-15V6Zm3 5.25h9v1.5h-9v-1.5Zm3 5.25h3v1.5h-3v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4.5 4.5h6.75v6.75H4.5V4.5Zm1.5 1.5v3.75h3.75V6H6Zm6.75-1.5h6.75v6.75h-6.75V4.5Zm1.5 1.5v3.75H18V6h-3.75ZM4.5 12.75h6.75v6.75H4.5v-6.75Zm1.5 1.5V18h3.75v-3.75H6Zm6.75-1.5h6.75v6.75h-6.75v-6.75Zm1.5 1.5V18H18v-3.75h-3.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ListIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5.25 6h13.5v1.5H5.25V6Zm0 5.25h13.5v1.5H5.25v-1.5Zm0 5.25h13.5V18H5.25v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3.75 1.07 1.94 2.2.39 1.56-1.6 1.59 1.58-1.61 1.6.4 2.2 1.89 1.09-.63 2.18-2.18-.02-1.55 1.59.38 2.18-2.11.85-1.01-1.93-2.19-.01-1.02 1.93-2.1-.85.38-2.18-1.55-1.59-2.18.02-.63-2.18 1.89-1.09.4-2.2-1.61-1.6 1.59-1.58 1.56 1.6 2.2-.39L12 3.75Zm0 5.25A3 3 0 1 0 12 15a3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 4.5h9A3.75 3.75 0 0 1 20.25 8.25v7.5A3.75 3.75 0 0 1 16.5 19.5h-9a3.75 3.75 0 0 1-3.75-3.75v-7.5A3.75 3.75 0 0 1 7.5 4.5Zm0 1.5A2.25 2.25 0 0 0 5.25 8.25v.75h13.5v-.75A2.25 2.25 0 0 0 16.5 6h-9Zm11.25 4.5H5.25v5.25A2.25 2.25 0 0 0 7.5 18h9a2.25 2.25 0 0 0 2.25-2.25V10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.94 5.47 1.06 1.06-4.47 4.47h9.47v1.5H10.53l4.47 4.47-1.06 1.06L7.66 12l6.28-6.53Z" fill="currentColor" />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}
