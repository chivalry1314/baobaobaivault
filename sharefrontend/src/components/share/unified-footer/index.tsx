"use client";

import { DEFAULT_FOOTER_TEXT } from "@/components/share/unified-footer/constants";
import type { UnifiedFooterProps } from "@/components/share/unified-footer/types";

export function UnifiedFooter({ text = DEFAULT_FOOTER_TEXT }: UnifiedFooterProps) {
  return (
    <footer className="relative z-10 px-6 pb-8 pt-8">
      <div className="mx-auto max-w-[var(--layout-max)] rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-4 text-center text-sm font-bold text-[var(--foreground)] sm:text-left">
        {text}
      </div>
    </footer>
  );
}
