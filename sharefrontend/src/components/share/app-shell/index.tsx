"use client";

import { NAV_ITEMS } from "@/components/share/app-shell/constants";
import {
  AppShellBackground,
  AppShellHeader,
} from "@/components/share/app-shell/sections";
import type { AppShellProps } from "@/components/share/app-shell/types";
import { useAccountEntry } from "@/components/share/account-entry/hooks";
import { UnifiedFooter } from "@/components/share/unified-footer/index";

export function AppShell({
  currentPath = "",
  children,
  headerSlot,
  footerSlot,
}: AppShellProps) {
  const { user } = useAccountEntry();
  void footerSlot;
  const normalizedFooter = <UnifiedFooter />;
  const navItems = NAV_ITEMS.filter((item) =>
    item.managerOnly ? user?.role === "manager" : true,
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <AppShellBackground />
      <AppShellHeader
        currentPath={currentPath}
        navItems={navItems}
        headerSlot={headerSlot}
      />
      <main className="relative z-10 flex-1">{children}</main>
      {normalizedFooter}
    </div>
  );
}

