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
  { href: "/system/access-keys", label: "访问密钥" },
  { href: "/system/roles", label: "角色权限" },
  { href: "/system/users", label: "用户管理" },
  { href: "/system/media-storage", label: "媒体存储" },
  { href: "/system/site-branding", label: "站点品牌" },
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
      <section className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 sm:pt-6 lg:px-8 2xl:px-10">
        <div className="grid gap-5 lg:grid-cols-[228px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="dream-panel px-4 py-4">
              <div className="border-b border-[rgba(220,173,187,0.35)] px-2 pb-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/45">
                  System
                </p>
                <h1 className="mt-2 text-xl font-black text-[var(--foreground)]">系统管理</h1>
              </div>

              <nav className="mt-4 hidden flex-col gap-2 lg:flex">
                {SYSTEM_NAV_ITEMS.map((item) => {
                  const active =
                    item.href === "/system"
                      ? currentPath === "/system"
                      : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-h-11 items-center rounded-full px-4 py-3 text-sm font-black transition ${
                        active
                          ? "btn-primary pointer-events-none justify-center"
                          : "btn-subtle text-[var(--foreground)]/78"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 lg:hidden">
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {SYSTEM_NAV_ITEMS.map((item) => {
                    const active =
                      item.href === "/system"
                        ? currentPath === "/system"
                        : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                          active
                            ? "btn-primary pointer-events-none"
                            : "btn-subtle text-[var(--foreground)]/78"
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

          <div className="flex min-w-0 flex-col gap-5">{children}</div>
        </div>
      </section>
    </AppShell>
  );
}
