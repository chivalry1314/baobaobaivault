import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

import {
  matchesAccessModeFilter,
  type ShareAccessModeFilter,
} from "@/components/share/access-mode-filter";
import {
  DISCOVER_PAGE_SIZE,
  type FilterChip,
} from "@/components/share/discover-home/constants";
import {
  matchesChip,
  resolveColumnCount,
  toHomeFeedCards,
  toRows,
} from "@/components/share/discover-home/helpers";
import type {
  DiscoverHomeHookResult,
  DiscoverInitialPayload,
} from "@/components/share/discover-home/types";
import { shareApi } from "@/lib/share-api";
import type { DiscoverCardItem } from "@/lib/shared";

export function useDiscoverHome({
  initialDiscover = null,
}: {
  initialDiscover?: DiscoverInitialPayload;
} = {}): DiscoverHomeHookResult {
  const [cards, setCards] = useState<DiscoverCardItem[]>(
    initialDiscover?.cards ?? [],
  );
  const [page, setPage] = useState(initialDiscover?.pagination.page ?? 1);
  const [hasMore, setHasMore] = useState(
    initialDiscover?.pagination.hasMore ?? true,
  );
  const [loading, setLoading] = useState(initialDiscover === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<FilterChip>("all");
  const [accessModeFilter, setAccessModeFilter] =
    useState<ShareAccessModeFilter>("all");
  const [columnCount, setColumnCount] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);

  const virtualListRef = useRef<HTMLDivElement | null>(null);
  const loadedCardIdsRef = useRef<Set<string>>(
    new Set((initialDiscover?.cards ?? []).map((item) => item.card.id)),
  );
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
    if (initialDiscover) {
      return;
    }

    let active = true;

    async function loadFirstPage() {
      setLoading(true);
      setError("");

      try {
        const payload = await shareApi.discoverCards({
          page: 1,
          size: DISCOVER_PAGE_SIZE,
        });

        if (!active) {
          return;
        }

        loadedCardIdsRef.current = new Set(
          payload.cards.map((item) => item.card.id),
        );
        setCards(payload.cards);
        setPage(payload.pagination.page);
        setHasMore(payload.pagination.hasMore);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "加载失败，请稍后重试。",
        );
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
  }, [initialDiscover]);

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
        const nextCards = payload.cards.filter(
          (item) => !existingCardIds.has(item.card.id),
        );

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
        setError(
          loadError instanceof Error ? loadError.message : "加载失败，请稍后重试。",
        );
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [hasMore, inView, loading, loadingMore, page]);

  const sourceCards = useMemo(() => toHomeFeedCards(cards), [cards]);

  const filteredCards = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    return sourceCards.filter((card) => {
      if (!matchesChip(card, activeChip)) {
        return false;
      }
      if (!matchesAccessModeFilter(card.accessMode, accessModeFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return card.searchableText.includes(keyword);
    });
  }, [activeChip, accessModeFilter, deferredQuery, sourceCards]);

  const cardRows = useMemo(
    () => toRows(filteredCards, columnCount),
    [filteredCards, columnCount],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateScrollMargin = () => {
      if (!virtualListRef.current) {
        return;
      }

      const nextMargin =
        virtualListRef.current.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) =>
        Math.abs(current - nextMargin) > 1 ? nextMargin : current,
      );
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

  return {
    query,
    setQuery,
    activeChip,
    setActiveChip,
    accessModeFilter,
    setAccessModeFilter,
    error,
    loading,
    loadingMore,
    hasMore,
    sourceCards,
    filteredCards,
    cardRows,
    columnCount,
    virtualListRef,
    loadMoreRef,
    virtualRows,
    totalHeight,
    rowVirtualizer,
    showInitialSkeleton,
    showNoResult,
    skeletonCount,
    resetFilters: () => {
      setQuery("");
      setActiveChip("all");
      setAccessModeFilter("all");
    },
  };
}
