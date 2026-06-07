"use client";

import { DEFAULT_FOOTER_TEXT } from "@/components/share/unified-footer/constants";
import type { UnifiedFooterProps } from "@/components/share/unified-footer/types";

export function UnifiedFooter({ text = DEFAULT_FOOTER_TEXT }: UnifiedFooterProps) {
  return (
    <footer className="relative z-10 px-6 pb-8 pt-8">
      <div className="mx-auto flex max-w-[var(--layout-max)] items-center justify-center rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-4 text-center text-sm font-bold text-[var(--foreground)]">
        <span className="text-center">{text}</span>
      </div>
    </footer>
  );
}
