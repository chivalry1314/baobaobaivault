import type { SettingsDraft } from "@/components/share/profile-settings/types";
import type { ExternalSessionUser } from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

export function createDraft(user: ExternalSessionUser): SettingsDraft {
  return {
    nickname: user.nickname,
    bio: user.bio,
    avatar: user.avatar,
    coverImage: user.coverImage,
    phone: user.phone,
  };
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

export function getInitials(user: ExternalSessionUser) {
  return Array.from(getDisplayName(user)).slice(0, 2).join("").toUpperCase() || shareSiteBrand.defaultInitials;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return phone.trim() || "未绑定";
  }

  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

export async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败，请重试"));
    reader.readAsDataURL(file);
  });
}

export function validateImage(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png"]);
  if (!allowedTypes.has(file.type)) {
    return "仅支持 JPG 或 PNG 图片";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "图片大小不能超过 5MB";
  }

  return "";
}
