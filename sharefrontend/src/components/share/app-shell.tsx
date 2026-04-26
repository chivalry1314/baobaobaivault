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
        <div className="sparkle-orb left-[-120px] top-16 h-72 w-72 bg-[rgba(255,182,193,0.45)]" />
        <div className="sparkle-orb right-[-80px] top-40 h-80 w-80 bg-[rgba(226,220,211,0.45)]" />
        <div className="sparkle-orb bottom-[-100px] left-1/4 h-96 w-96 bg-[rgba(250,211,253,0.34)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-semibold italic tracking-tight text-[var(--brand-strong)]">
            CardShare
          </Link>

          <nav className="hidden items-center gap-3 md:flex">
            {navItems.map((item) => {
              const active = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--primary)] text-white shadow-[var(--shadow-glow)]"
                      : "text-[var(--foreground)]/72 hover:bg-white hover:text-[var(--brand-strong)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">{headerSlot !== undefined ? headerSlot : <AccountEntry />}</div>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>
      {footerSlot}
    </div>
  );
}
