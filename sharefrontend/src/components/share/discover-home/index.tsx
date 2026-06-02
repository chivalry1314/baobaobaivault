"use client";

import { AppShell } from "@/components/share/app-shell";
import { useDiscoverHome } from "@/components/share/discover-home/hooks";
import {
  DiscoverAccessModeFilters,
  DiscoverChips,
  DiscoverError,
  DiscoverGridSkeleton,
  DiscoverLoadingMore,
  DiscoverMetrics,
  DiscoverNoResult,
  DiscoverSearchBar,
  DiscoverVirtualRows,
} from "@/components/share/discover-home/sections";
import type { DiscoverHomeProps } from "@/components/share/discover-home/types";

export function DiscoverHome({ initialDiscover }: DiscoverHomeProps) {
  const {
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
    resetFilters,
  } = useDiscoverHome({ initialDiscover });

  return (
    <AppShell currentPath="/">
      <section className="relative z-10 mx-auto mt-3 w-full max-w-[var(--layout-max)] px-4 pb-6 md:px-6">
        <main className="mt-4 w-full">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 xl:mx-0">
            <DiscoverSearchBar query={query} setQuery={setQuery} />
            <DiscoverChips
              activeChip={activeChip}
              setActiveChip={setActiveChip}
            />
            <DiscoverAccessModeFilters
              value={accessModeFilter}
              onChange={setAccessModeFilter}
            />

            {error ? <DiscoverError error={error} /> : null}

            <div ref={virtualListRef}>
              {showInitialSkeleton ? (
                <DiscoverGridSkeleton
                  columnCount={columnCount}
                  skeletonCount={skeletonCount}
                />
              ) : showNoResult ? (
                <DiscoverNoResult onReset={resetFilters} />
              ) : (
                <DiscoverVirtualRows
                  columnCount={columnCount}
                  totalHeight={totalHeight}
                  virtualRows={virtualRows}
                  rowVirtualizer={rowVirtualizer}
                  cardRows={cardRows}
                />
              )}
            </div>

            {loadingMore ? (
              <DiscoverLoadingMore columnCount={columnCount} />
            ) : null}

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
