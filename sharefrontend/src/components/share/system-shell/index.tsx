"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/share/app-shell";

const SYSTEM_NAV_ITEMS = [
  { href: "/system", label: "总览" },
  { href: "/system/storage", label: "存储配置" },
  { href: "/system/namespaces", label: "命名空间" },
  { href: "/system/objects", label: "对象管理" },
  { href: "/system/audit", label: "操作审计" },
  { href: "/system/roles", label: "角色权限" },
  { href: "/system/users", label: "用户管理" },
  { href: "/system/media-storage", label: "媒体存储" },
  { href: "/system/site-branding", label: "站点品牌" },
  { href: "/system/category-settings", label: "分类开关" },
  { href: "/system/auth-settings", label: "认证设置" },
];

export function SystemWorkspace(props: {
  currentPath: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { currentPath, children } = props;

  return (
    <AppShell currentPath={currentPath}>
      <section className="relative mx-auto flex w-full max-w-[var(--layout-max)] flex-col gap-4 px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.2rem] border-2 border-[var(--outline)] bg-white p-3 shadow-sm">
              <div className="border-b border-[var(--outline)]/20 px-2 pb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--foreground)]/40">
                  System
                </p>
                <h1 className="mt-1 text-base font-black text-[var(--foreground)]">系统管理</h1>
              </div>

              <nav className="mt-3 hidden flex-col gap-1.5 lg:flex">
                {SYSTEM_NAV_ITEMS.map((item) => {
                  const active =
                    item.href === "/system"
                      ? currentPath === "/system"
                      : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-h-[34px] items-center rounded-full px-3 py-1.5 text-xs font-black transition ${
                        active
                          ? "bg-[var(--button-primary)] text-[var(--foreground)]"
                          : "text-[var(--foreground)]/72 hover:bg-[var(--surface-container)]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-3 lg:hidden">
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                  {SYSTEM_NAV_ITEMS.map((item) => {
                    const active =
                      item.href === "/system"
                        ? currentPath === "/system"
                        : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                          active
                            ? "bg-[var(--button-primary)] text-[var(--foreground)]"
                            : "border border-[var(--outline)]/20 bg-white text-[var(--foreground)]/72 hover:bg-[var(--surface-container)]"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </div>
      </section>
    </AppShell>
  );
}
