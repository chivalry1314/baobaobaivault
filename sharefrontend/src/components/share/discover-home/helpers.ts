import {
  CARD_BG_CLASSES,
  CATEGORY_SLOTS,
  type FilterChip,
} from "@/components/share/discover-home/constants";
import type { HomeFeedCard } from "@/components/share/discover-home/types";
import type { CardContentSlot, DiscoverCardItem } from "@/lib/shared";

export function resolveColumnCount(viewportWidth: number) {
  if (viewportWidth >= 1280) {
    return 3;
  }
  if (viewportWidth >= 640) {
    return 2;
  }
  return 1;
}

export function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function matchesChip(card: HomeFeedCard, chip: FilterChip) {
  if (chip === "all") {
    return true;
  }
  return card.tags.includes(chip);
}

export function toRows(cards: HomeFeedCard[], columnCount: number) {
  if (cards.length === 0) {
    return [] as HomeFeedCard[][];
  }
  const rows: HomeFeedCard[][] = [];
  for (let i = 0; i < cards.length; i += columnCount) {
    rows.push(cards.slice(i, i + columnCount));
  }
  return rows;
}

export function toHomeFeedCards(cards: DiscoverCardItem[]): HomeFeedCard[] {
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
      bgClass: CARD_BG_CLASSES[item.card.id.length % CARD_BG_CLASSES.length],
    };
  });
}
