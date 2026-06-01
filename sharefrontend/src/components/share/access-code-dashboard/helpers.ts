import type { AccessCodeDashboardItem } from "@/lib/shared";

export const ACCESS_CODES_PAGE_SIZE = 12;
export const CARDS_WITHOUT_CODE_PAGE_SIZE = 9;

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "长期有效";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "SSR";
  }
  if (downloadCount >= 30) {
    return "SR";
  }
  return "R";
}

export function isExhausted(item: AccessCodeDashboardItem) {
  return !item.config.unlimited && item.config.usageLimit > 0 && item.config.usageCount >= item.config.usageLimit;
}

export function isActiveItem(item: AccessCodeDashboardItem) {
  return item.isPubliclyVisible && item.config.isActive;
}

export function getInactiveReason(item: AccessCodeDashboardItem) {
  if (!item.isPubliclyVisible) {
    return "卡片当前为私密状态，外部用户无法通过提取码访问。";
  }

  if (item.config.isExpired) {
    return "提取码已过期，请重新启用后再分享。";
  }

  if (isExhausted(item)) {
    return "提取码已达到使用次数上限，请调整后再分享。";
  }

  return "提取码当前处于停用状态，可重新启用后继续分享。";
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function buildCardShareLink(cardId: string, code: string) {
  const url = new URL(`/cards/${encodeURIComponent(cardId)}`, window.location.origin);
  if (code.trim()) {
    url.searchParams.set("code", code.trim());
  }
  return url.toString();
}
