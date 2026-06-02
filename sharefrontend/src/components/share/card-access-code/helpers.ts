import type {
  CardAccessCodeConfig,
  CardDetailResponse,
  ExternalSessionUser,
} from "@/lib/shared";

import type { ExpireOption } from "@/components/share/card-access-code/types";

export const expireOptions: ExpireOption[] = [
  { value: 1, label: "1 天", description: "短期时效分享" },
  { value: 7, label: "7 天", description: "推荐有效期" },
  { value: 0, label: "永久", description: "不限制到期时间" },
];

export function getDisplayName(
  user: ExternalSessionUser | CardDetailResponse["creator"],
) {
  if ("email" in user) {
    const nickname = user.nickname.trim();
    if (nickname) {
      return nickname;
    }

    const username = user.username.trim();
    if (username) {
      return username;
    }

    return user.email.split("@")[0]?.trim() || "CardShare";
  }

  return user.nickname.trim() || user.username.trim() || "CardShare";
}

export function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function chunk(length: number) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
  }

  return `${chunk(3)}-${chunk(3)}-${chunk(3)}`;
}

export function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "UR";
  }
  if (downloadCount >= 20) {
    return "SR";
  }
  return "R";
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN");
}

export function getSubmitButtonLabel(pending: boolean) {
  return pending ? "保存中..." : "保存提取码设置";
}

export function getUsageHelperText(config: CardAccessCodeConfig | null) {
  if (!config?.isActive) {
    return "";
  }

  const usage = `当前提取码已使用 ${config.usageCount} 次。`;
  if (config.expiresAt) {
    return `${usage} 到期时间：${formatDateTime(config.expiresAt)}`;
  }
  return `${usage} 当前为永久有效。`;
}
