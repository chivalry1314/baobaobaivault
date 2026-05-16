"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AccountEntry } from "@/components/share/account-entry";

type AppShellProps = {
  currentPath?: string;
  children: ReactNode;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/discover", label: "发现卡片" },
  { href: "/creator", label: "创作中心" },
];

export function AppShell({ currentPath = "", children, headerSlot, footerSlot }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sparkle-orb left-[-120px] top-16 h-72 w-72 bg-[rgba(174,230,248,0.45)]" />
        <div className="sparkle-orb right-[-80px] top-40 h-80 w-80 bg-[rgba(210,236,249,0.4)]" />
        <div className="sparkle-orb bottom-[-100px] left-1/4 h-96 w-96 bg-[rgba(248,219,230,0.24)]" />
      </div>

      <header className="sticky top-0 z-40 px-3 pb-2 pt-3 sm:px-6 sm:pt-4">
        <div className="floating-nav mx-auto max-w-7xl rounded-[28px] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="min-w-0">
              <p className="type-overline text-[var(--primary)]/68">Card Share</p>
              <p className="type-h3 mt-1 text-[var(--primary)]">Dreamy Card Gallery</p>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const active = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-[linear-gradient(135deg,var(--primary)_0%,var(--secondary)_100%)] text-white shadow-[var(--shadow-glow)]"
                        : "chip-pill text-[var(--foreground)]/74 hover:text-[var(--brand-strong)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">{headerSlot !== undefined ? headerSlot : <AccountEntry />}</div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {navItems.map((item) => {
              const active = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-[linear-gradient(135deg,var(--primary)_0%,var(--secondary)_100%)] text-white shadow-[var(--shadow-glow)]"
                      : "chip-pill text-[var(--foreground)]/74"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 pb-2">{children}</main>
      {footerSlot}
    </div>
  );
}
