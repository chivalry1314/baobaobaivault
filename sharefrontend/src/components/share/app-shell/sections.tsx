import Link from "next/link";
import type { ReactNode } from "react";

import { AccountEntry } from "@/components/share/account-entry";
import { isNavItemActive } from "@/components/share/app-shell/helpers";
import { ShareSiteBrandMark } from "@/components/share/site-brand";
import type { NavItem } from "@/components/share/app-shell/types";

export function AppShellBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute left-[-5%] top-[8%] h-[150px] w-[400px] rounded-full bg-white/40 blur-2xl" />
      <div className="absolute left-[-10%] top-[60%] h-[100px] w-[300px] rounded-full bg-white/40 blur-3xl" />
      <div className="absolute bottom-[5%] right-[-5%] h-[200px] w-[500px] rounded-full bg-white/40 blur-2xl" />
      <div className="absolute right-[20%] top-[15%] h-[100px] w-[250px] rounded-full bg-white/40 blur-2xl" />
    </div>
  );
}

export function AppShellHeader(props: {
  currentPath: string;
  navItems: NavItem[];
  headerSlot?: ReactNode;
}) {
  const { currentPath, navItems, headerSlot } = props;

  return (
    <header className="relative z-10 px-4 pb-1 pt-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center justify-between gap-4 py-2 sm:flex-row">
        <Link href="/" className="flex items-center gap-3 self-start sm:self-auto">
          <ShareSiteBrandMark />
        </Link>

        <DesktopNav currentPath={currentPath} navItems={navItems} />

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-3">
            {headerSlot !== undefined ? headerSlot : <AccountEntry />}
          </div>
        </div>
      </div>

      <MobileNav currentPath={currentPath} navItems={navItems} />
    </header>
  );
}

function DesktopNav(props: { currentPath: string; navItems: NavItem[] }) {
  const { currentPath, navItems } = props;
  return (
    <div className="floating-nav hidden items-center gap-2 rounded-full p-1.5 lg:flex">
      {navItems.map((item) => {
        const active = isNavItemActive(currentPath, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${
              active
                ? "btn-primary pointer-events-none inline-flex min-h-11 items-center justify-center"
                : "inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2.5 font-black text-[var(--foreground)] hover:bg-gray-100"
            } ${active ? "rounded-full px-8 py-2.5 font-black" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function MobileNav(props: { currentPath: string; navItems: NavItem[] }) {
  const { currentPath, navItems } = props;
  return (
    <div className="mx-auto max-w-[var(--layout-max)] lg:hidden">
      <div className="floating-nav no-scrollbar flex items-center gap-2 overflow-x-auto rounded-full p-1.5">
        {navItems.map((item) => {
          const active = isNavItemActive(currentPath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-black ${
                active ? "btn-primary pointer-events-none" : "btn-subtle"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
