import type { Metadata } from "next";

import { ShareSiteBrandProvider } from "@/components/share/site-brand/provider";
import { ShareSessionProvider } from "@/components/share/session-provider";
import { getServerSiteBrandingSettings } from "@/lib/server-share-api";
import { applyShareSiteBrand, shareSiteBrand } from "@/lib/site-config";
import type { ShareSiteBrandingSettings } from "@/lib/shared";

import "./globals.css";

export const metadata: Metadata = {
  title: shareSiteBrand.siteName,
  description: shareSiteBrand.siteDescription,
};

function mergeBrandWithFallback(
  brand: Partial<ShareSiteBrandingSettings> | null | undefined,
): ShareSiteBrandingSettings {
  return {
    siteName: brand?.siteName || shareSiteBrand.siteName,
    siteShortName: brand?.siteShortName || shareSiteBrand.siteShortName,
    siteDescription: brand?.siteDescription || shareSiteBrand.siteDescription,
    siteSubtitle: brand?.siteSubtitle || shareSiteBrand.siteSubtitle,
    showSiteSubtitle: brand?.showSiteSubtitle ?? shareSiteBrand.showSiteSubtitle,
    authSubtitle: brand?.authSubtitle || shareSiteBrand.authSubtitle,
    showAuthSubtitle: brand?.showAuthSubtitle ?? shareSiteBrand.showAuthSubtitle,
    logoText: brand?.logoText || shareSiteBrand.logoText,
    logoBadgeText: brand?.logoBadgeText || shareSiteBrand.logoBadgeText,
    logoImageSrc: brand?.logoImageSrc || shareSiteBrand.logoImageSrc,
    logoOriginalFileName: brand?.logoOriginalFileName || shareSiteBrand.logoOriginalFileName,
    logoMimeType: brand?.logoMimeType || shareSiteBrand.logoMimeType,
    footerText: brand?.footerText || shareSiteBrand.footerText,
    defaultDisplayName: brand?.defaultDisplayName || shareSiteBrand.defaultDisplayName,
    defaultCreatorName: brand?.defaultCreatorName || shareSiteBrand.defaultCreatorName,
    defaultCreatorHandle: brand?.defaultCreatorHandle || shareSiteBrand.defaultCreatorHandle,
    defaultInitials: brand?.defaultInitials || shareSiteBrand.defaultInitials,
    creatorTagline: brand?.creatorTagline || shareSiteBrand.creatorTagline,
    canUpdate: false,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeBrand = mergeBrandWithFallback(await getServerSiteBrandingSettings());
  applyShareSiteBrand(runtimeBrand);
  const runtimeMetadata: Metadata = {
    title: runtimeBrand.siteName,
    description: runtimeBrand.siteDescription,
  };

  return (
    <html lang="zh-CN" className="antialiased" data-scroll-behavior="smooth">
      <head>
        <title>{String(runtimeMetadata.title)}</title>
        <meta name="description" content={runtimeMetadata.description ?? ""} />
      </head>
      <body>
        <ShareSiteBrandProvider brand={runtimeBrand}>
          <ShareSessionProvider>{children}</ShareSessionProvider>
        </ShareSiteBrandProvider>
      </body>
    </html>
  );
}
