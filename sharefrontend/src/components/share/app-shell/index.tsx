"use client";

import { NAV_ITEMS } from "@/components/share/app-shell/constants";
import {
  AppShellBackground,
  AppShellHeader,
} from "@/components/share/app-shell/sections";
import type { AppShellProps } from "@/components/share/app-shell/types";
import { UnifiedFooter } from "@/components/share/unified-footer/index";

export function AppShell({
  currentPath = "",
  children,
  headerSlot,
  footerSlot,
}: AppShellProps) {
  void footerSlot;
  const normalizedFooter = <UnifiedFooter />;

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <AppShellBackground />
      <AppShellHeader
        currentPath={currentPath}
        navItems={NAV_ITEMS}
        headerSlot={headerSlot}
      />
      <main className="relative z-10 flex-1">{children}</main>
      {normalizedFooter}
    </div>
  );
}

