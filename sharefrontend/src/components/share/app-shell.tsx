"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AccountEntry } from "@/components/share/account-entry";
import { UnifiedFooter } from "@/components/share/unified-footer";

type AppShellProps = {
  currentPath?: string;
  children: ReactNode;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/discover", label: "发现卡片" },
  { href: "/creator/new", label: "创作中心" },
];

export function AppShell({ currentPath = "", children, headerSlot, footerSlot }: AppShellProps) {
  void footerSlot;
  const normalizedFooter = <UnifiedFooter />;

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-5%] top-[8%] h-[150px] w-[400px] rounded-full bg-white/40 blur-2xl" />
        <div className="absolute left-[-10%] top-[60%] h-[100px] w-[300px] rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-[5%] right-[-5%] h-[200px] w-[500px] rounded-full bg-white/40 blur-2xl" />
        <div className="absolute right-[20%] top-[15%] h-[100px] w-[250px] rounded-full bg-white/40 blur-2xl" />
      </div>

      <header className="relative z-10 px-4 pb-1 pt-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center justify-between gap-4 py-2 sm:flex-row">
          <Link href="/" className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex h-12 w-12 -rotate-6 items-center justify-center rounded-xl border-[3px] border-[var(--outline)] bg-white">
              <div className="h-8 w-8 rounded bg-gradient-to-tr from-purple-400 to-blue-300 ring-2 ring-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-none tracking-tight text-[var(--foreground)]">Dreamy</h1>
              <p className="text-sm font-extrabold text-[var(--foreground)]">Card Gallery</p>
            </div>
          </Link>

          <div className="floating-nav hidden items-center gap-2 rounded-full p-1.5 lg:flex">
            {navItems.map((item) => {
              const active = item.href.startsWith("/creator") ? currentPath.startsWith("/creator") : currentPath === item.href;
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

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex items-center gap-3">{headerSlot !== undefined ? headerSlot : <AccountEntry />}</div>
          </div>
        </div>

        <div className="mx-auto max-w-[var(--layout-max)] lg:hidden">
          <div className="floating-nav no-scrollbar flex items-center gap-2 overflow-x-auto rounded-full p-1.5">
            {navItems.map((item) => {
              const active = item.href.startsWith("/creator") ? currentPath.startsWith("/creator") : currentPath === item.href;
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
      </header>

      <main className="relative z-10 flex-1">{children}</main>
      {normalizedFooter}
    </div>
  );
}
