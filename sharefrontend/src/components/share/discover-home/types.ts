import type { CardContentSlot, DiscoverCardItem } from "@/lib/shared";

import type { FilterChip } from "@/components/share/discover-home/constants";
import type { ShareAccessModeFilter } from "@/components/share/access-mode-filter";

export type HomeFeedCard = {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  metric: string;
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
