import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";

import type { ShareAccessModeFilter } from "@/components/share/access-mode-filter";
import type { FilterChip } from "@/components/share/discover-home/constants";
import type { CardContentSlot, DiscoverCardItem } from "@/lib/shared";

export type HomeFeedCard = {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  metric: string;
  favoriteCount: number;
  isFavorited: boolean;
  accessMode: "free" | "paid";
  href: string;
  imageUrl: string;
  searchableText: string;
  tags: CardContentSlot[];
  bgClass: string;
};

export type DiscoverState = {
  cards: DiscoverCardItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  query: string;
  activeChip: FilterChip;
  accessModeFilter: ShareAccessModeFilter;
  columnCount: number;
  scrollMargin: number;
};

export type DiscoverInitialPayload = {
  cards: DiscoverCardItem[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
} | null;

export type DiscoverHomeProps = {
  initialDiscover?: DiscoverInitialPayload;
};

export type DiscoverHomeHookResult = {
  query: string;
  setQuery: (value: string) => void;
  activeChip: FilterChip;
  setActiveChip: (chip: FilterChip) => void;
  accessModeFilter: ShareAccessModeFilter;
  setAccessModeFilter: (value: ShareAccessModeFilter) => void;
  error: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sourceCards: HomeFeedCard[];
  filteredCards: HomeFeedCard[];
  cardRows: HomeFeedCard[][];
  columnCount: number;
  virtualListRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: (node?: Element | null) => void;
  virtualRows: VirtualItem[];
  totalHeight: number;
  rowVirtualizer: Virtualizer<Window, Element>;
  showInitialSkeleton: boolean;
  showNoResult: boolean;
  skeletonCount: number;
  resetFilters: () => void;
};
