"use client";

import Image from "next/image";

export interface ShareImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  unoptimized?: boolean;
}

function canUseNextImage(src: string): boolean {
  if (!src) return false;
  // Next.js Image works best with same-origin relative paths.
  // Blob/data URLs, absolute external URLs, and SVGs fall back to native img
  // to avoid remotePatterns / optimization edge cases.
  if (src.startsWith("blob:") || src.startsWith("data:")) return false;
  if (src.startsWith("http://") || src.startsWith("https://")) return false;
  if (src.toLowerCase().includes(".svg")) return false;
  return true;
}

// Dynamic media endpoints may require session cookies or return redirects.
// The Next.js image optimizer cannot reliably fetch them, so keep next/image
// for layout/lazy-loading but skip the optimization step.
function isDynamicMediaEndpoint(src: string): boolean {
  return (
    /^\/api\/share\/cards\/[^/]+\/cover\/(preview|download)/.test(src) ||
    /^\/api\/share\/cards\/[^/]+\/assets\/[^/]+\/(preview|download)/.test(src) ||
    /^\/api\/share\/users\/[^/]+\/assets\//.test(src)
  );
}

export function ShareImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  priority,
  sizes,
  unoptimized,
}: ShareImageProps) {
  if (!src) {
    return null;
  }

  const hasExplicitSize = typeof width === "number" && typeof height === "number";
  const useNextImage = canUseNextImage(src) && (fill || hasExplicitSize);
  const shouldUnoptimize = unoptimized ?? isDynamicMediaEndpoint(src);

  if (useNextImage) {
    return (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={className}
        priority={priority}
        sizes={sizes}
        unoptimized={shouldUnoptimize}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
