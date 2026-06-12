"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { SystemBackLink } from "@/components/share/system-back-link";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareSystemRole } from "@/lib/shared";

const PAGE_SIZE = 10;

type RoleScope = "all" | "system" | "custom";

export function ShareSystemRolesPage() {
  const { user, sessionChecking } = useShareSession();
  const [items, setItems] = useState<ShareSystemRole[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<RoleScope>("all");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [submittedScopeFilter, setSubmittedScopeFilter] = useState<RoleScope>("all");
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadRoles(1, submittedSearch, submittedScopeFilter);
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  async function loadRoles(nextPage: number, keyword: string, scope: RoleScope) {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemRoles({
        page: nextPage,
        pageSize: PAGE_SIZE,
        keyword,
        scope,
      });
      setItems(response.items || []);
      setTotal(response.pagination?.total || 0);
      setPage(response.pagination?.page || nextPage);
      setPageSize(response.pagination?.pageSize || PAGE_SIZE);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载角色信息失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = search.trim();
    setSubmittedSearch(nextKeyword);
    setSubmittedScopeFilter(scopeFilter);
    await loadRoles(1, nextKeyword, scopeFilter);
  }

  async function handlePageChange(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    await loadRoles(nextPage, submittedSearch, submittedScopeFilter);
  }

  if (sessionChecking) {
    return <SystemLoadingPage currentPath="/system/roles" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/roles" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/roles" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/roles"
      title="角色权限"
      description="这里展示 sharefrontend 当前真实生效的内建角色体系。用户的实际角色变更请到用户管理页面操作。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--outline)]/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-[var(--foreground)]">内建角色</h2>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
              第 {safePage} / {totalPages} 页，共 {total} 个角色
            </p>
          </div>
          <Link href="/system/users" className="inline-flex items-center justify-center rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]">
            去用户管理
          </Link>
        </div>

        <form className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSubmitFilters}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">搜索角色</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按角色名、编码或说明搜索"
              className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">角色范围</span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as RoleScope)}
              className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none"
            >
              <option value="all">全部角色</option>
              <option value="system">系统角色</option>
              <option value="custom">自定义角色</option>
            </select>
          </label>

          <div className="flex items-end">
            <button type="submit" className="w-full rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] lg:w-auto">
              应用筛选
            </button>
          </div>
        </form>

        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs font-bold text-[var(--foreground)]/55">正在加载角色列表...</p>
          ) : items.length === 0 ? (
            <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-5 text-center">
              <p className="text-xs font-black text-[var(--foreground)]/60">{submittedScopeFilter === "custom" ? "当前统一方案下没有自定义角色。" : "没有符合条件的角色。"}</p>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-[1.1rem] border-2 border-[var(--outline)] bg-white p-3 shadow-sm transition hover:shadow-md">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-black text-[var(--foreground)]">{item.name}</h3>
                  <span className="rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] font-black text-[var(--foreground)]/72">
                    {item.code}
                  </span>
                  <span className="rounded-full border border-[#f3d89a] bg-[#fff9e8] px-1.5 py-0.5 text-[10px] font-black text-[#8a5a00]">
                    Lv.{item.level ?? 0}
                  </span>
                  <span className="rounded-full border border-[#c5d8f7] bg-[#f0f6ff] px-1.5 py-0.5 text-[10px] font-black text-[#2752a3]">
                    系统角色
                  </span>
                </div>

                <p className="mt-1 text-xs font-bold text-[var(--foreground)]/60">{item.description || "暂无说明"}</p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.permissions || []).map((permission) => (
                    <span key={permission.id} className="rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--foreground)]/65">
                      {permission.description || permission.code}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-4" />
      </section>
    </SystemWorkspace>
  );
}

export function ShareSystemRoleCreatePage() {
  return (
    <SystemWorkspace
      currentPath="/system/roles"
      title="新增角色"
      description="统一后的 share 用户体系目前只保留内建角色，不再支持在这里新增旧 RBAC 自定义角色。"
    >
      <SystemBackLink href="/system/roles" label="返回角色页" />

      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="border-b border-[var(--outline)]/20 pb-3">
          <h2 className="text-base font-black text-[var(--foreground)]">角色已统一</h2>
        </div>
        <p className="mt-3 text-xs font-bold leading-6 text-[var(--foreground)]/65">
          当前系统已经按 sharefrontend 的真实用户体系统一为浏览者、创作者、管理员三种内建角色。用户角色调整请前往用户管理页面处理。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/system/users" className="inline-flex rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]">
            去用户管理
          </Link>
        </div>
      </section>
    </SystemWorkspace>
  );
}

export function ShareSystemRoleEditPage() {
  return (
    <SystemWorkspace
      currentPath="/system/roles"
      title="编辑角色"
      description="统一后的 share 用户体系目前只保留内建角色，不再支持编辑旧 RBAC 自定义角色。"
    >
      <SystemBackLink href="/system/roles" label="返回角色页" />

      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">角色已统一</h2>
        </div>
        <p className="mt-6 text-sm font-bold leading-7 text-[var(--foreground)]/68">
          这里展示的角色是系统内建角色，实际变更请在用户管理页面直接调整用户的角色。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/system/users" className="btn-primary inline-flex rounded-full px-6 py-3 text-sm font-black">
            去用户管理
          </Link>
        </div>
      </section>
    </SystemWorkspace>
  );
}

function SystemLoadingPage({ currentPath, text }: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 text-sm font-bold text-[var(--foreground)]/70 shadow-sm">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 shadow-sm">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">
          当前账号不是系统初始化超级管理员，无法访问此页面。
        </p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">{message}</p>;
}
