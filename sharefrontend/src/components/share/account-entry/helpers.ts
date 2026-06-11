import type { ExternalSessionUser } from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

export function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const username = user.username.trim();
  if (username) {
    return username;
  }

  const emailName = user.email.split("@")[0]?.trim();
  return emailName || shareSiteBrand.defaultDisplayName;
}

export function getInitials(user: ExternalSessionUser) {
  return Array.from(getDisplayName(user)).slice(0, 2).join("").toUpperCase() || shareSiteBrand.defaultInitials;
}

export function getEntryLabel(user: ExternalSessionUser | null) {
  return user ? "进入个人主页" : "登录或注册";
}

export function getEntryTitle(user: ExternalSessionUser | null) {
  return user ? `${getDisplayName(user)} 的个人主页` : "登录或注册";
}
