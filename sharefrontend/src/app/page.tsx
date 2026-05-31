"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

import { AppShell } from "@/components/share/app-shell";
import { shareApi } from "@/lib/share-api";
import type { CardContentSlot, DiscoverCardItem } from "@/lib/shared";

type HomeFeedCard = {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  metric: string;
  href: string;
  imageUrl: string;
  searchableText: string;
  tags: CardContentSlot[];
  bgClass: string;
};

const CATEGORY_SLOTS = ["system_theme", "wechat_theme", "app", "character_persona", "world_book"] as const;
const filterChips = ["all", ...CATEGORY_SLOTS] as const;
type FilterChip = (typeof filterChips)[number];

const chipLabels: Record<FilterChip, string> = {
  all: "全部",
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
};

const chipVisuals: Record<FilterChip, { className: string }> = {
  all: { className: "bg-[#aee7d9]" },
  system_theme: { className: "bg-[#facdf4]" },
  wechat_theme: { className: "bg-[#ff9c9c]" },
  app: { className: "bg-[#fcf1a7]" },
  character_persona: { className: "bg-[#cdb4f3]" },
  world_book: { className: "bg-[#ffcda8]" },
};

const DISCOVER_PAGE_SIZE = 12;

function resolveColumnCount(viewportWidth: number) {
  if (viewportWidth >= 1280) {
    return 3;
  }
  if (viewportWidth >= 640) {
    return 2;
  }
  return 1;
}

function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function matchesChip(card: HomeFeedCard, chip: FilterChip) {
  if (chip === "all") {
    return true;
  }
  return card.tags.includes(chip);
}

function toRows(cards: HomeFeedCard[], columnCount: number) {
  if (cards.length === 0) {
    return [] as HomeFeedCard[][];
  }
  const rows: HomeFeedCard[][] = [];
  for (let i = 0; i < cards.length; i += columnCount) {
    rows.push(cards.slice(i, i + columnCount));
  }
  return rows;
}

export default function LandingPage() {
  const [cards, setCards] = useState<DiscoverCardItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<FilterChip>("all");
  const [columnCount, setColumnCount] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);

  const virtualListRef = useRef<HTMLDivElement | null>(null);
  const loadedCardIdsRef = useRef<Set<string>>(new Set());
  const { ref: loadMoreRef, inView } = useInView({
    root: null,
    rootMargin: "640px 0px",
    threshold: 0,
  });

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateColumns = () => {
      setColumnCount(resolveColumnCount(window.innerWidth));
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => {
      window.removeEventListener("resize", updateColumns);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFirstPage() {
      setLoading(true);
      setError("");

      try {
        const payload = await shareApi.discoverCards({ page: 1, size: DISCOVER_PAGE_SIZE });
        if (!active) {
          return;
        }

        loadedCardIdsRef.current = new Set(payload.cards.map((item) => item.card.id));
        setCards(payload.cards);
        setPage(payload.pagination.page);
        setHasMore(payload.pagination.hasMore);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "加载失败，请稍后重试。");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFirstPage();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!inView || !hasMore || loading || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const nextPage = page + 1;

    void shareApi
      .discoverCards({ page: nextPage, size: DISCOVER_PAGE_SIZE })
      .then((payload) => {
        const existingCardIds = loadedCardIdsRef.current;
        const nextCards = payload.cards.filter((item) => !existingCardIds.has(item.card.id));
        if (nextCards.length > 0) {
          nextCards.forEach((item) => {
            existingCardIds.add(item.card.id);
          });
          setCards((current) => [...current, ...nextCards]);
        }
        setPage(payload.pagination.page);
        if (payload.cards.length === 0 || nextCards.length === 0) {
          setHasMore(false);
          return;
        }
        setHasMore(payload.pagination.hasMore);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "加载失败，请稍后重试。");
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [hasMore, inView, loading, loadingMore, page]);

  const sourceCards = useMemo<HomeFeedCard[]>(() => {
    return cards.map((item) => {
      const titleText = item.card.title ?? "未命名卡片";
      const descriptionText = item.card.description || "创作者暂未填写描述。";
      const creatorName = item.creator.nickname || item.creator.username || "Creator";

      const tags = (item.card.categories ?? []).filter((slot): slot is CardContentSlot =>
        CATEGORY_SLOTS.includes(slot as (typeof CATEGORY_SLOTS)[number]),
      );

      return {
        id: item.card.id,
        title: titleText,
        description: descriptionText,
        creatorName,
        metric: formatMetric(item.stats.downloadCount),
        href: `/cards/${encodeURIComponent(item.card.id)}`,
        imageUrl: item.card.previewUrl,
        searchableText: [
          titleText,
          descriptionText,
          item.creator.nickname,
          item.creator.username,
          item.card.originalFileName,
          tags.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        tags,
        bgClass: ["bg-[#fcf1a7]", "bg-[#facdf4]", "bg-[#aee7d9]", "bg-[#cdb4f3]"][item.card.id.length % 4],
      };
    });
  }, [cards]);

  const filteredCards = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    return sourceCards.filter((card) => {
      if (!matchesChip(card, activeChip)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return card.searchableText.includes(keyword);
    });
  }, [activeChip, deferredQuery, sourceCards]);

  const cardRows = useMemo(() => {
    return toRows(filteredCards, columnCount);
  }, [filteredCards, columnCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateScrollMargin = () => {
      if (!virtualListRef.current) {
        return;
      }
      const nextMargin = virtualListRef.current.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) => (Math.abs(current - nextMargin) > 1 ? nextMargin : current));
    };

    updateScrollMargin();
    const rafId = window.requestAnimationFrame(updateScrollMargin);
    window.addEventListener("resize", updateScrollMargin);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateScrollMargin);
    };
  }, [cardRows.length, columnCount, loading, error]);

  const rowVirtualizer = useWindowVirtualizer({
    count: cardRows.length,
    estimateSize: () => 420,
    overscan: 4,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const showInitialSkeleton = loading && sourceCards.length === 0;
  const showNoResult = !showInitialSkeleton && filteredCards.length === 0;
  const skeletonCount = columnCount * 2;

  const footer = (
    <footer className="relative z-10 px-5 pb-6 pt-6">
      <div className="mx-auto max-w-[var(--layout-max)] rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-4 text-center text-sm font-bold text-[var(--foreground)] sm:text-left">
        © 2026 Card Share
      </div>
    </footer>
  );

  return (
    <AppShell currentPath="/" footerSlot={footer}>
      <section className="relative z-10 mx-auto mt-3 w-full max-w-[var(--layout-max)] px-4 pb-6 md:px-6">
        <main className="mt-4 w-full">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 xl:mx-0">
            <div className="group relative">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索卡片..."
                className="w-full rounded-full border-[4px] border-[var(--outline)] bg-white px-5 py-3 pr-16 text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition-all group-hover:bg-gray-50"
              />
              <button className="absolute bottom-1.5 right-1.5 top-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[var(--outline)] bg-[#cdb4f3] transition-all hover:opacity-90">
                <SearchIcon />
              </button>
            </div>

            <div className="no-scrollbar flex items-end justify-between gap-3 overflow-x-auto px-1 py-1 lg:gap-5">
              {filterChips.map((chip) => {
                const active = chip === activeChip;
                return (
                  <button key={chip} type="button" onClick={() => setActiveChip(chip)} className="group shrink-0 cursor-pointer">
                    <span className="flex flex-col items-center gap-2">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-[4px] border-[var(--outline)] xl:h-14 xl:w-14 ${active ? "bg-[#cdb4f3]" : chipVisuals[chip].className} transition-all group-hover:opacity-90`}
                      >
                        <ChipIcon chip={chip} />
                      </span>
                      <span className="text-sm font-extrabold text-[var(--foreground)] xl:text-base">{chipLabels[chip]}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="rounded-2xl border-[4px] border-[#c26b5b] bg-[#fff0eb] px-4 py-3 text-sm font-bold text-[#8e2b1b]">{error}</div>
            ) : null}

            <div ref={virtualListRef}>
              {showInitialSkeleton ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                  {Array.from({ length: skeletonCount }).map((_, index) => (
                    <CardSkeleton key={index} />
                  ))}
                </div>
              ) : showNoResult ? (
                <div className="rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-9 text-center text-[var(--foreground)]">
                  <p className="text-2xl font-black">没有找到匹配内容</p>
                  <p className="mt-3 font-bold">当前筛选无结果，请尝试切换分类或关键词。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveChip("all");
                    }}
                    className="btn-primary mt-4 rounded-full px-5 py-2.5 font-black"
                  >
                    重置筛选
                  </button>
                </div>
              ) : (
                <div className="relative w-full" style={{ height: `${Math.max(totalHeight, 1)}px` }}>
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
                        <div className="grid gap-4 pb-4" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                          {rowCards.map((card, offset) => (
                            <CardItem key={card.id} card={card} index={virtualRow.index * columnCount + offset} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {loadingMore ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                {Array.from({ length: columnCount }).map((_, index) => (
                  <CardSkeleton key={`loading-more-${index}`} />
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="metric-pill rounded-full px-3 py-1.5 font-black">
                {loading ? "加载中..." : `已展示 ${filteredCards.length} 条`}
              </span>
              {!loading && filteredCards.length !== sourceCards.length ? (
                <span className="metric-pill rounded-full px-3 py-1.5 font-black">共加载 {sourceCards.length} 条</span>
              ) : null}
              {loadingMore ? <span className="metric-pill rounded-full px-3 py-1.5 font-black">正在加载更多...</span> : null}
              {!loading && !hasMore ? <span className="metric-pill rounded-full px-3 py-1.5 font-black">已全部加载</span> : null}
            </div>

            <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
          </div>
        </main>
      </section>
    </AppShell>
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
            #{chipLabels[card.tags[0] ?? "all"]}
          </span>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border-[3px] border-[var(--outline)] bg-white">
          {card.imageUrl ? (
            <img src={card.imageUrl} className="h-full w-full object-cover object-center" alt={card.title} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#ecefff] text-sm font-bold text-[var(--text-subtle)]">暂无封面</div>
          )}
        </div>
      </div>

      <h4 className="px-1 text-[1.5rem] font-black text-[var(--foreground)]">{card.title}</h4>
      <p className="mt-1.5 line-clamp-2 text-sm font-bold text-[var(--on-surface-variant)]">{card.description}</p>
      <div className="mt-2.5 flex items-center justify-between px-1 text-xs font-bold text-[var(--foreground)]/68">
        <span>{card.creatorName}</span>
        <span>{card.metric}</span>
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
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="4">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2 14 8.8 21 12l-7 3.2L12 22l-2-6.8L3 12l7-3.2L12 2Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-[#ff9c9c] text-[var(--foreground)]" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 20.2 4.94 13.5a4.65 4.65 0 0 1 6.58-6.58L12 7.4l.48-.48a4.65 4.65 0 0 1 6.58 6.58L12 20.2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m14.8 3.6 5.6 5.6-9.9 9.9-6 .4.4-6 9.9-9.9Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="m10 8.7 6 3.3-6 3.3V8.7Z" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3.5 18h17L15 10.5l-3.4 4.1-2.5-2.8L3.5 18Z" />
      <circle cx="18" cy="7" r="1.6" />
    </svg>
  );
}
