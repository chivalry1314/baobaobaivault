import { SLOT_LABEL_MAP } from "@/components/share/card-detail/constants";
import type { CardViewModel } from "@/components/share/card-detail/types";
import type { CardAsset, CardDetailResponse } from "@/lib/shared";

export function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

export function getCreatorName(detail: CardDetailResponse) {
  return detail.creator.nickname.trim() || detail.creator.username.trim() || "CardShare Creator";
}

export function getCreatorHandle(detail: CardDetailResponse) {
  const username = detail.creator.username.trim();
  if (username) {
    return `@${username}`;
  }
  return "@cardshare";
}

export function getInitials(name: string) {
  const value = name.trim();
  if (!value) {
    return "CS";
  }
  return Array.from(value).slice(0, 2).join("").toUpperCase();
}

export function buildSlotTags(detail: CardDetailResponse) {
  const categories = detail.card.categories ?? [];
  if (categories.length === 0) {
    return ["#卡片", "#分享"];
  }
  return categories.map((slot) => `#${SLOT_LABEL_MAP[slot] ?? slot}`);
}

export function pickDisplayAsset(detail: CardDetailResponse): CardAsset | null {
  if (!detail.assets || detail.assets.length === 0) {
    return null;
  }

  for (const asset of detail.assets) {
    if (asset.mimeType.startsWith("image/")) {
      return asset;
    }
  }

  return detail.assets[0] ?? null;
}

export function buildCardViewModel(detail: CardDetailResponse | null, unlockCode: string): CardViewModel {
  const creatorName = detail ? getCreatorName(detail) : "";
  const creatorHandle = detail ? getCreatorHandle(detail) : "";
  const metric = detail ? formatMetric(detail.stats.downloadCount) : "0";
  const tags = detail ? buildSlotTags(detail) : [];
  const accessCodeStatus = detail?.accessCodeStatus ?? "none";
  const requiresAccessCode = Boolean(detail && !detail.canEdit && accessCodeStatus === "required");
  const normalizedUnlockCode = unlockCode.trim().toUpperCase();
  const displayAsset = detail ? pickDisplayAsset(detail) : null;

  const cardMimeType = detail?.card.mimeType.trim().toLowerCase() ?? "";
  const assetMimeType = displayAsset?.mimeType.trim().toLowerCase() ?? "";
  const hasCardImage = Boolean(detail?.card.previewUrl.trim()) && cardMimeType.startsWith("image/");
  const heroImageUrl = hasCardImage
    ? detail?.card.previewUrl ?? ""
    : assetMimeType.startsWith("image/")
      ? displayAsset?.previewUrl ?? ""
      : "";
  const heroFallbackText = displayAsset?.originalFileName || detail?.card.title || "Card";

  const downloadHint = detail?.canEdit
    ? "你创建的卡片可直接下载分类文件。"
    : requiresAccessCode
      ? "请先输入提取码后再下载分类文件。"
      : accessCodeStatus === "expired"
        ? "当前提取码已过期，暂时无法下载。"
        : accessCodeStatus === "exhausted"
          ? "当前提取码使用次数已达上限，暂时无法下载。"
          : "公开卡片可直接下载各分类文件。";

  return {
    creatorName,
    creatorHandle,
    metric,
    tags,
    accessCodeStatus,
    requiresAccessCode,
    normalizedUnlockCode,
    displayAsset,
    cardMimeType,
    assetMimeType,
    hasCardImage,
    heroImageUrl,
    heroFallbackText,
    downloadHint,
  };
}
