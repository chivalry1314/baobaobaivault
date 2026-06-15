import {
  getSlotLabel as getSlotLabelFromRegistry,
  slotOptions,
} from "@/components/share/card-editor/slot-registry";
import type {
  CardAsset,
  CardContentSlot,
  CardDetailResponse,
  ExternalSessionUser,
  ShareReviewStatus,
} from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

export type SlotFileItem = {
  slot: CardContentSlot;
  file: File | null;
};

export function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }
  const username = user.username.trim();
  if (username) {
    return username;
  }
  return user.email.split("@")[0]?.trim() || shareSiteBrand.defaultDisplayName;
}

export function composeSearchableSummary(text: string) {
  const clean = text.trim();
  if (!clean) {
    return "这是一张等待补充内容的卡片，完善描述后会更完整。";
  }
  return clean.length > 80 ? `${clean.slice(0, 80)}...` : clean;
}

export function getStatusLabel(status: CardDetailResponse["card"]["status"]) {
  if (status === "published") {
    return "已发布";
  }
  if (status === "draft") {
    return "草稿";
  }
  return "已归档";
}

export function getReviewStatusLabel(status: ShareReviewStatus) {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "未提交审核";
  }
}

export function createEmptySlotItem(
  index: number,
  enabledSlots?: CardContentSlot[],
): SlotFileItem {
  const source = enabledSlots?.length ? enabledSlots : slotOptions.map((option) => option.value);
  return {
    slot: source[index % source.length],
    file: null,
  };
}

export function isImageMime(file: File | null) {
  return Boolean(file && file.type.startsWith("image/"));
}

export function findDuplicateSlots(items: SlotFileItem[]) {
  const map = new Map<CardContentSlot, number>();
  for (const item of items) {
    map.set(item.slot, (map.get(item.slot) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .filter(([, count]) => count > 1)
    .map(([slot]) => slot);
}

export function getSlotLabel(slot: CardContentSlot) {
  return getSlotLabelFromRegistry(slot);
}

export function findAssetBySlot(assets: CardAsset[], slot: CardContentSlot) {
  return assets.find((asset) => asset.slot === slot) ?? null;
}

export function isCreatorRole(user: ExternalSessionUser | null) {
  if (!user) {
    return false;
  }
  return user.role === "creator" || user.role === "manager";
}
