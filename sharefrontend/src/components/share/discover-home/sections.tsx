import Link from "next/link";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";

import type { ShareAccessModeFilter } from "@/components/share/access-mode-filter";
import { AccessModeBadge } from "@/components/share/access-mode-badge";
import { FavoriteButton } from "@/components/share/favorite-button";
import {
  CHIP_LABELS,
  CHIP_VISUALS,
  FILTER_CHIPS,
  type FilterChip,
} from "@/components/share/discover-home/constants";
import type { HomeFeedCard } from "@/components/share/discover-home/types";

export function DiscoverSearchBar(props: {
  query: string;
  setQuery: (value: string) => void;
}) {
  const { query, setQuery } = props;

  return (
    <div className="group relative">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索卡片..."
        className="w-full rounded-full border-[4px] border-[var(--outline)] bg-white px-5 py-3 pr-16 text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition-all group-hover:bg-gray-50"
      />
      <button
        type="button"
        aria-label="搜索"
        className="absolute bottom-1.5 right-1.5 top-1.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#cdb4f3] shadow-sm transition-all hover:opacity-90"
      >
        <SearchIcon />
      </button>
    </div>
  );
}

export function DiscoverChips(props: {
  activeChip: FilterChip;
  setActiveChip: (chip: FilterChip) => void;
}) {
  const { activeChip, setActiveChip } = props;

  return (
    <div className="relative">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-1 py-1">
        {FILTER_CHIPS.map((chip) => {
          const active = chip === activeChip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChip(chip)}
              className={`group shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-black transition-all ${
                active
                  ? `${CHIP_VISUALS[chip].className} border-transparent text-[var(--foreground)] shadow-sm`
                  : "border-[var(--outline)]/40 bg-white/60 text-[var(--foreground)]/75 hover:border-[var(--outline)] hover:bg-white"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${active ? "bg-white/40" : CHIP_VISUALS[chip].className}`}>
                <ChipIcon chip={chip} />
              </span>
              <span>{CHIP_LABELS[chip]}</span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--background)] to-transparent" />
    </div>
  );
}

export function DiscoverAccessModeFilters(props: {
  value: ShareAccessModeFilter;
  onChange: (value: ShareAccessModeFilter) => void;
}) {
  const options: Array<{ value: ShareAccessModeFilter; label: string }> = [
    { value: "all", label: "全部" },
    { value: "free", label: "免费" },
    { value: "paid", label: "需提取码" },
  ];

  return (
    <div className="inline-flex items-center rounded-full border-2 border-[var(--outline)] bg-white p-1 shadow-sm">
      {options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            className={`relative rounded-full px-4 py-1.5 text-sm font-black transition-all ${
              active
                ? "bg-[var(--foreground)] text-white shadow-sm"
                : "text-[var(--foreground)]/70 hover:bg-[var(--foreground)]/5"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function DiscoverError(props: { error: string }) {
  return (
    <div className="rounded-2xl border-[4px] border-[#c26b5b] bg-[#fff0eb] px-4 py-3 text-sm font-bold text-[#8e2b1b]">
      {props.error}
    </div>
  );
}

export function DiscoverGridSkeleton(props: {
  columnCount: number;
  skeletonCount: number;
}) {
  const { columnCount, skeletonCount } = props;
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export function DiscoverNoResult(props: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-[var(--outline)] bg-white px-6 py-14 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--outline)] bg-[var(--secondary)]">
        <SearchIcon />
      </div>
      <p className="mt-5 text-xl font-black text-[var(--foreground)]">没有找到匹配内容</p>
      <p className="mt-2 max-w-xs text-sm font-bold text-[var(--foreground)]/62">
        当前筛选无结果，试试切换分类、调整访问方式或换个关键词。
      </p>
      <button
        type="button"
        onClick={props.onReset}
        className="btn-primary mt-5 rounded-full px-5 py-2.5 text-sm font-black"
      >
        重置筛选
      </button>
    </div>
  );
}

export function DiscoverVirtualRows(props: {
  columnCount: number;
  totalHeight: number;
  virtualRows: VirtualItem[];
  rowVirtualizer: Virtualizer<Window, Element>;
  cardRows: HomeFeedCard[][];
}) {
  const { columnCount, totalHeight, virtualRows, rowVirtualizer, cardRows } =
    props;

  return (
    <div
      className="relative w-full"
      style={{ height: `${Math.max(totalHeight, 1)}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const rowCards = cardRows[virtualRow.index] ?? [];
        const rowStart = virtualRow.start - rowVirtualizer.options.scrollMargin;

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${rowStart}px)`,
            }}
          >
            <div
              className="grid gap-4 pb-4"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
            >
              {rowCards.map((card, offset) => (
                <CardItem
                  key={card.id}
                  card={card}
                  index={virtualRow.index * columnCount + offset}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DiscoverLoadingMore(props: { columnCount: number }) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${props.columnCount}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: props.columnCount }).map((_, index) => (
        <CardSkeleton key={`loading-more-${index}`} />
      ))}
    </div>
  );
}

export function DiscoverMetrics(props: {
  loading: boolean;
  filteredCount: number;
  sourceCount: number;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  const { loading, filteredCount, sourceCount, loadingMore, hasMore } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-[var(--foreground)]/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--outline)] border-t-[var(--primary)]" />
        正在加载...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 py-4 text-xs font-bold text-[var(--foreground)]/50">
      <div className="flex items-center gap-2">
        <span>已展示 {filteredCount} 条</span>
        {filteredCount !== sourceCount ? (
          <>
            <span className="h-1 w-1 rounded-full bg-[var(--foreground)]/30" />
            <span>共 {sourceCount} 条</span>
          </>
        ) : null}
      </div>
      {loadingMore ? (
        <span className="text-[var(--primary)]">正在加载更多...</span>
      ) : !hasMore ? (
        <span>已全部加载</span>
      ) : null}
    </div>
  );
}

function CardItem({ card, index }: { card: HomeFeedCard; index: number }) {
  return (
    <Link
      href={card.href}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-[var(--outline)] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ animationDelay: `${(index % 12) * 45}ms` }}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-[#f4f6ff]">
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded-full border border-white/50 bg-white/90 px-2 py-0.5 text-[10px] font-black text-[var(--foreground)] backdrop-blur-sm">
            #{CHIP_LABELS[card.tags[0] ?? "all"]}
          </span>
        </div>

        <div className="absolute right-2 top-2 z-10">
          <AccessModeBadge
            mode={card.accessMode}
            compact
            className="border border-white/50 shadow-sm"
          />
        </div>

        <div className="absolute bottom-2 right-2 z-10">
          <FavoriteButton
            cardId={card.id}
            initialFavorited={card.isFavorited}
            initialCount={card.favoriteCount}
            size="compact"
          />
        </div>

        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            alt={card.title}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--text-subtle)]">
            暂无封面
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h4 className="line-clamp-1 text-base font-black text-[var(--foreground)]">
          {card.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-[var(--foreground)]/60">
          {card.description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] font-bold text-[var(--foreground)]/55">
          <span className="truncate">{card.creatorName}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <DownloadIcon className="h-3 w-3" />
            {card.metric}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border-2 border-[var(--outline)] bg-white shadow-sm">
      <div className="aspect-[3/2] bg-[#ecefff]" />
      <div className="p-3">
        <div className="h-4 rounded-full bg-[#d9d3ee]" />
        <div className="mt-2 h-3 rounded-full bg-[#ecefff]" />
        <div className="mt-1.5 h-3 w-4/5 rounded-full bg-[#ecefff]" />
        <div className="mt-3 flex items-center justify-between">
          <div className="h-3 w-20 rounded-full bg-[#d9d3ee]" />
          <div className="h-3 w-10 rounded-full bg-[#ecefff]" />
        </div>
      </div>
    </div>
  );
}

function ChipIcon({ chip }: { chip: FilterChip }) {
  switch (chip) {
    case "all":
      return <GridIcon />;
    case "system_theme":
      return <SparkleIcon />;
    case "wechat_theme":
      return <HeartIcon />;
    case "app":
      return <PencilIcon />;
    case "character_persona":
      return <PlayIcon />;
    case "world_book":
      return <MountainIcon />;
    default:
      return <GridIcon />;
  }
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 2 14 8.8 21 12l-7 3.2L12 22l-2-6.8L3 12l7-3.2L12 2Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 fill-[#ff9c9c] text-[var(--foreground)]"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 20.2 4.94 13.5a4.65 4.65 0 0 1 6.58-6.58L12 7.4l.48-.48a4.65 4.65 0 0 1 6.58 6.58L12 20.2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="m14.8 3.6 5.6 5.6-9.9 9.9-6 .4.4-6 9.9-9.9Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="m10 8.7 6 3.3-6 3.3V8.7Z" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M3.5 18h17L15 10.5l-3.4 4.1-2.5-2.8L3.5 18Z" />
      <circle cx="18" cy="7" r="1.6" />
    </svg>
  );
}

function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

