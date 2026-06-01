import type { CardContentSlot, DiscoverCardItem } from "@/lib/shared";

import type { FilterChip } from "@/components/share/discover-home/constants";

export type HomeFeedCard = {
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

export type DiscoverState = {
  cards: DiscoverCardItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  query: string;
  activeChip: FilterChip;
  columnCount: number;
  scrollMargin: number;
};
