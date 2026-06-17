import type { DashboardCard, ExternalSessionUser, PlatformCard } from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

export const CARDS_PAGE_SIZE = 9;
export const HISTORY_PAGE_SIZE = 8;
export const USER_PAGE_SIZE = 10;

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatUid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) % 900000;
  }
  return String(hash + 100000);
}

export function formatCardCode(cardId: string) {
  return cardId.replace(/-/g, "").slice(0, 10).toUpperCase();
}

export function formatMetricValue(value: number) {
  if (value < 1000) {
    return String(value);
  }
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(value)
    .toUpperCase();
}

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

export function getInitials(name: string) {
  const clean = name.trim();
  if (!clean) {
    return shareSiteBrand.defaultInitials;
  }
  return Array.from(clean).slice(0, 2).join("").toUpperCase();
}

export function getUserTagline(user: ExternalSessionUser | null) {
  if (!user) {
    return "";
  }
  const bio = user.bio.trim();
  if (bio) {
    return bio;
  }
  return shareSiteBrand.creatorTagline;
}

export function isImageCard(card: PlatformCard) {
  return typeof card.mimeType === "string" && card.mimeType.startsWith("image/") && Boolean(card.previewUrl.trim());
}

export function getCardRank(item: DashboardCard) {
  if (item.stats.downloadCount >= 50) {
    return { label: "SSR", className: "bg-[#ffe06f] text-[#6d3a00]" };
  }
  if (item.stats.downloadCount >= 10) {
    return { label: "SR", className: "bg-[#f4c7df] text-[#6c3756]" };
  }
  return { label: "R", className: "bg-[#d4f0ff] text-[#255d72]" };
}

export function getVisibilityLabel(value: PlatformCard["visibility"]) {
  return value === "public" ? "公开" : "私密";
}

export function getStatusLabel(value: PlatformCard["status"]) {
  switch (value) {
    case "published":
      return "已发布";
    case "draft":
      return "草稿";
    case "delisted":
      return "已下架";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

export function getReviewStatusLabel(value: PlatformCard["reviewStatus"]) {
  switch (value) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "未提交";
  }
}

export function defaultCardDescription(card: PlatformCard) {
  const text = card.description.trim();
  if (text) {
    return text;
  }
  return "这张卡片还没有填写描述，点击管理可补充详情。";
}
