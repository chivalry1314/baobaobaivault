"use client";

import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";

import { AppShell } from "@/components/share/app-shell";
import { useDiscoverHome } from "@/components/share/discover-home/hooks";
import {
  DiscoverChips,
  DiscoverError,
  DiscoverGridSkeleton,
  DiscoverLoadingMore,
  DiscoverMetrics,
  DiscoverNoResult,
  DiscoverSearchBar,
  DiscoverVirtualRows,
} from "@/components/share/discover-home/sections";
import type { HomeFeedCard } from "@/components/share/discover-home/types";
import type { FilterChip } from "@/components/share/discover-home/constants";

type RowVirtualizer = Virtualizer<Window, Element>;

export function DiscoverHome() {
  const {
    query,
    setQuery,
    activeChip,
    setActiveChip,
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
    resetFilters,
  } = useDiscoverHome();

  const typedVirtualRows = virtualRows as VirtualItem[];
  const typedRowVirtualizer = rowVirtualizer as RowVirtualizer;
  const typedCardRows = cardRows as HomeFeedCard[][];
  const typedSetQuery = setQuery as (value: string) => void;
  const typedSetActiveChip = setActiveChip as (chip: FilterChip) => void;

  return (
    <AppShell currentPath="/">
      <section className="relative z-10 mx-auto mt-3 w-full max-w-[var(--layout-max)] px-4 pb-6 md:px-6">
        <main className="mt-4 w-full">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 xl:mx-0">
            <DiscoverSearchBar query={query} setQuery={typedSetQuery} />
            <DiscoverChips activeChip={activeChip} setActiveChip={typedSetActiveChip} />

            {error ? <DiscoverError error={error} /> : null}

            <div ref={virtualListRef}>
              {showInitialSkeleton ? (
                <DiscoverGridSkeleton columnCount={columnCount} skeletonCount={skeletonCount} />
              ) : showNoResult ? (
                <DiscoverNoResult onReset={resetFilters} />
              ) : (
                <DiscoverVirtualRows
                  columnCount={columnCount}
                  totalHeight={totalHeight}
                  virtualRows={typedVirtualRows}
                  rowVirtualizer={typedRowVirtualizer}
                  cardRows={typedCardRows}
                />
              )}
            </div>

            {loadingMore ? <DiscoverLoadingMore columnCount={columnCount} /> : null}

            <DiscoverMetrics
              loading={loading}
              filteredCount={filteredCards.length}
              sourceCount={sourceCards.length}
              loadingMore={loadingMore}
              hasMore={hasMore}
            />

            <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
          </div>
        </main>
      </section>
    </AppShell>
  );
}
