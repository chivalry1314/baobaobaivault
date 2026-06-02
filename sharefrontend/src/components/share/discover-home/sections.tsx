import Link from "next/link";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";

import {
  AccessModeFilterPills,
  type ShareAccessModeFilter,
} from "@/components/share/access-mode-filter";
import { AccessModeBadge } from "@/components/share/access-mode-badge";
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
        className="absolute bottom-1.5 right-1.5 top-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[var(--outline)] bg-[#cdb4f3] transition-all hover:opacity-90"
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
    <div className="no-scrollbar flex items-end justify-between gap-3 overflow-x-auto px-1 py-1 lg:gap-5">
      {FILTER_CHIPS.map((chip) => {
        const active = chip === activeChip;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => setActiveChip(chip)}
            className="group shrink-0 cursor-pointer"
          >
            <span className="flex flex-col items-center gap-2">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-[4px] border-[var(--outline)] xl:h-14 xl:w-14 ${
                  active ? "bg-[#cdb4f3]" : CHIP_VISUALS[chip].className
                } transition-all group-hover:opacity-90`}
              >
                <ChipIcon chip={chip} />
              </span>
              <span className="text-sm font-extrabold text-[var(--foreground)] xl:text-base">
                {CHIP_LABELS[chip]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DiscoverAccessModeFilters(props: {
  value: ShareAccessModeFilter;
  onChange: (value: ShareAccessModeFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border-[4px] border-[var(--outline)] bg-white px-4 py-3">
      <div>
        <div className="text-sm font-black text-[var(--foreground)]">
          访问方式
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--foreground)]/56">
          快速筛选免费卡片或需要提取码的卡片
        </div>
      </div>
      <AccessModeFilterPills value={props.value} onChange={props.onChange} />
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
    <div className="rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-9 text-center text-[var(--foreground)]">
      <p className="text-2xl font-black">没有找到匹配内容</p>
      <p className="mt-3 font-bold">
        当前筛选无结果，请尝试切换分类或关键词。
      </p>
      <button
        type="button"
        onClick={props.onReset}
        className="btn-primary mt-4 rounded-full px-5 py-2.5 font-black"
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

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="metric-pill rounded-full px-3 py-1.5 font-black">
        {loading ? "加载中..." : `已展示 ${filteredCount} 条`}
      </span>
      {!loading && filteredCount !== sourceCount ? (
        <span className="metric-pill rounded-full px-3 py-1.5 font-black">
          共加载 ${sourceCount} 条
        </span>
      ) : null}
      {loadingMore ? (
        <span className="metric-pill rounded-full px-3 py-1.5 font-black">
          正在加载更多...
        </span>
      ) : null}
      {!loading && !hasMore ? (
        <span className="metric-pill rounded-full px-3 py-1.5 font-black">
          已全部加载
        </span>
      ) : null}
    </div>
  );
}

function CardItem({ card, index }: { card: HomeFeedCard; index: number }) {
  return (
    <Link
      href={card.href}
      className={`${card.bgClass} dream-card card-hover-lift fade-slide-in flex h-full flex-col p-3.5`}
      style={{ animationDelay: `${(index % 12) * 45}ms` }}
    >
      <div className="relative mb-2.5">
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded-full border-[3px] border-[var(--outline)] bg-white px-3 py-0.5 text-xs font-black text-[var(--foreground)]">
            #{CHIP_LABELS[card.tags[0] ?? "all"]}
          </span>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border-[3px] border-[var(--outline)] bg-white">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              className="h-full w-full object-cover object-center"
              alt={card.title}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#ecefff] text-sm font-bold text-[var(--text-subtle)]">
              暂无封面
            </div>
          )}
        </div>
      </div>

      <h4 className="px-1 text-[1.5rem] font-black text-[var(--foreground)]">
        {card.title}
      </h4>
      <p className="mt-1.5 line-clamp-2 text-sm font-bold text-[var(--on-surface-variant)]">
        {card.description}
      </p>
      <div className="mt-2.5 flex items-center justify-between px-1 text-xs font-bold text-[var(--foreground)]/68">
        <span>{card.creatorName}</span>
        <span>{card.metric}</span>
      </div>
      <div className="mt-2 px-1">
        <AccessModeBadge mode={card.accessMode} compact />
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="dream-card animate-pulse bg-white p-3.5">
      <div className="aspect-[4/3] rounded-2xl border-[3px] border-[var(--outline)] bg-[#ecefff]" />
      <div className="mt-3 h-5 rounded-full bg-[#d9d3ee]" />
      <div className="mt-2 h-4 rounded-full bg-[#ecefff]" />
      <div className="mt-1.5 h-4 w-4/5 rounded-full bg-[#ecefff]" />
      <div className="mt-3 flex items-center justify-between">
        <div className="h-3.5 w-24 rounded-full bg-[#d9d3ee]" />
        <div className="h-3.5 w-12 rounded-full bg-[#d9d3ee]" />
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
