import type { VisibilityFilterOption } from "@/components/share/access-code-card-picker/types";
import type { AccessCodeDashboardItem, DashboardCard, PlatformCard } from "@/lib/shared";

export const filterOptions: VisibilityFilterOption[] = [
  { value: "all", label: "全部卡片", description: "显示你可用于创建提取码的所有卡片" },
  { value: "public", label: "仅公开", description: "只显示公开可见的卡片" },
  { value: "private", label: "仅私密", description: "只显示私密卡片" },
];

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isImageCard(card: PlatformCard) {
  return typeof card.mimeType === "string" && card.mimeType.startsWith("image/") && Boolean(card.previewUrl.trim());
}

export function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "UR";
  }
  if (downloadCount >= 30) {
    return "SSR";
  }
  if (downloadCount >= 10) {
    return "SR";
  }
  return "R";
}

export function getVisibilityLabel(card: PlatformCard) {
  if (card.visibility === "private") {
    return "私密";
  }
  if (card.status === "draft") {
    return "草稿";
  }
  return "公开";
}

export function buildSelectableCards(cards: DashboardCard[], availableIds: Set<string>) {
  return cards
    .filter((item) => availableIds.has(item.card.id))
    .sort((left, right) => new Date(right.card.updatedAt).getTime() - new Date(left.card.updatedAt).getTime());
}

export function buildSelectableCardIds(availableCards: PlatformCard[], items: AccessCodeDashboardItem[]) {
  const ids = new Set(availableCards.map((card) => card.id));

  for (const item of items) {
    if (!item.config.isActive || !item.isPubliclyVisible) {
      ids.add(item.card.id);
    }
  }

  return ids;
}

export function pickSelectedCardId(cards: DashboardCard[], currentId: string) {
  if (cards.length === 0) {
    return "";
  }
  if (cards.some((item) => item.card.id === currentId)) {
    return currentId;
  }
  return cards[0]?.card.id ?? "";
}
