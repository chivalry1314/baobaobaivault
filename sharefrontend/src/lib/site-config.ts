type ShareSiteBrandConfig = {
  siteName: string;
  siteShortName: string;
  siteDescription: string;
  siteSubtitle: string;
  showSiteSubtitle: boolean;
  authSubtitle: string;
  showAuthSubtitle: boolean;
  logoText: string;
  logoBadgeText: string;
  logoImageSrc: string;
  logoOriginalFileName: string;
  logoMimeType: string;
  footerText: string;
  defaultDisplayName: string;
  defaultCreatorName: string;
  defaultCreatorHandle: string;
  defaultInitials: string;
  creatorTagline: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function fallbackInitials(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "CS";
  }
  const initials = Array.from(clean.replace(/\s+/g, ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "CS";
}

const siteShortName = readEnv("NEXT_PUBLIC_SHARE_SITE_SHORT_NAME") || "Dreamy";
const siteName = readEnv("NEXT_PUBLIC_SHARE_SITE_NAME") || "Dreamy Card Gallery";

export const shareSiteBrand: ShareSiteBrandConfig = {
  siteName,
  siteShortName,
  siteDescription:
    readEnv("NEXT_PUBLIC_SHARE_SITE_DESCRIPTION") ||
    "Storefront for browsing and redeeming shared cards.",
  siteSubtitle: readEnv("NEXT_PUBLIC_SHARE_SITE_SUBTITLE") || "Card Gallery",
  showSiteSubtitle: readEnv("NEXT_PUBLIC_SHARE_SITE_SHOW_SUBTITLE") !== "false",
  authSubtitle:
    readEnv("NEXT_PUBLIC_SHARE_SITE_AUTH_SUBTITLE") || `${siteName} account`,
  showAuthSubtitle: readEnv("NEXT_PUBLIC_SHARE_SITE_SHOW_AUTH_SUBTITLE") !== "false",
  logoText:
    readEnv("NEXT_PUBLIC_SHARE_SITE_LOGO_TEXT") || fallbackInitials(siteShortName),
  logoBadgeText: readEnv("NEXT_PUBLIC_SHARE_SITE_LOGO_BADGE_TEXT") || "",
  logoImageSrc: readEnv("NEXT_PUBLIC_SHARE_SITE_LOGO_IMAGE"),
  logoOriginalFileName: "",
  logoMimeType: "",
  footerText:
    readEnv("NEXT_PUBLIC_SHARE_SITE_FOOTER_TEXT") || `(c) 2026 ${siteName}`,
  defaultDisplayName:
    readEnv("NEXT_PUBLIC_SHARE_SITE_DEFAULT_DISPLAY_NAME") || siteName,
  defaultCreatorName:
    readEnv("NEXT_PUBLIC_SHARE_SITE_DEFAULT_CREATOR_NAME") ||
    `${siteShortName} Creator`,
  defaultCreatorHandle:
    readEnv("NEXT_PUBLIC_SHARE_SITE_DEFAULT_CREATOR_HANDLE") ||
    `@${siteShortName.toLowerCase().replace(/\s+/g, "")}`,
  defaultInitials:
    readEnv("NEXT_PUBLIC_SHARE_SITE_DEFAULT_INITIALS") ||
    fallbackInitials(siteShortName),
  creatorTagline:
    readEnv("NEXT_PUBLIC_SHARE_SITE_CREATOR_TAGLINE") ||
    `Show your work in ${siteShortName} and let more people discover your ideas.`,
};

export function applyShareSiteBrand(
  next: Partial<ShareSiteBrandConfig> | null | undefined,
) {
  if (!next) {
    return shareSiteBrand;
  }
  Object.assign(shareSiteBrand, next);
  return shareSiteBrand;
}
