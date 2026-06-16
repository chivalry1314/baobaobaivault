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
  /** 编辑模式：当前已存在的资产（如果有） */
  originalAsset?: CardAsset | null;
  /** 编辑模式：标记计划删除已有资产 */
  pendingDelete?: boolean;
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

export function createSlotItemsFromAssets(
  assets: CardAsset[],
  enabledSlots?: CardContentSlot[],
): SlotFileItem[] {
  if (assets.length === 0) {
    return [createEmptySlotItem(0, enabledSlots)];
  }
  return assets.map((asset) => ({
    slot: asset.slot,
    file: null,
    originalAsset: asset,
  }));
}

export type SlotChangeItem = {
  slot: CardContentSlot;
  file: File;
  originalAsset: CardAsset | null;
};

export type SlotDeleteItem = {
  slot: CardContentSlot;
  originalAsset: CardAsset;
};

export function computeSlotChanges(items: SlotFileItem[]): {
  changes: SlotChangeItem[];
  deletes: SlotDeleteItem[];
} {
  const changes: SlotChangeItem[] = [];
  const deletes: SlotDeleteItem[] = [];

  for (const item of items) {
    if (item.pendingDelete && item.originalAsset) {
      deletes.push({ slot: item.originalAsset.slot, originalAsset: item.originalAsset });
      continue;
    }

    if (item.file) {
      changes.push({ slot: item.slot, file: item.file, originalAsset: item.originalAsset ?? null });
    }
  }

  return { changes, deletes };
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
