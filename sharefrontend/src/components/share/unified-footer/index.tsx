"use client";

import { useShareSiteBrand } from "@/components/share/site-brand/provider";
import type { UnifiedFooterProps } from "@/components/share/unified-footer/types";

export function UnifiedFooter({ text }: UnifiedFooterProps) {
  const brand = useShareSiteBrand();
  const footerText = text ?? brand.footerText;
  return (
    <footer className="relative z-10 px-6 pb-8 pt-8">
      <div className="mx-auto flex max-w-[var(--layout-max)] items-center justify-center rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-4 text-center text-sm font-bold text-[var(--foreground)]">
        <span className="text-center">{footerText}</span>
      </div>
    </footer>
  );
}
