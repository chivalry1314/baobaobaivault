"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
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

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">内建角色</h2>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
                第 {safePage} / {totalPages} 页，共 {total} 个角色
              </p>
            </div>
            <Link href="/system/users" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black">
              去用户管理
            </Link>
          </div>

          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleSubmitFilters}>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">搜索角色</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按角色名、编码或说明搜索"
                className="dream-input w-full px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">角色范围</span>
              <select
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value as RoleScope)}
                className="dream-input w-full px-4 py-3"
              >
                <option value="all">全部角色</option>
                <option value="system">系统角色</option>
                <option value="custom">自定义角色</option>
              </select>
            </label>

            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full rounded-full px-5 py-3 text-sm font-black lg:w-auto">
                应用筛选
              </button>
            </div>
          </form>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载角色列表...</p>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
              <p>{submittedScopeFilter === "custom" ? "当前统一方案下没有自定义角色。" : "没有符合条件的角色。"}</p>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="dream-panel-soft rounded-[22px] px-4 py-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-[var(--foreground)]">{item.name}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                      {item.code}
                    </span>
                    <span className="rounded-full bg-[rgba(246,215,184,0.9)] px-3 py-1 text-xs font-black text-[#8a4b16]">
                      Level {item.level ?? 0}
                    </span>
                    <span className="rounded-full bg-[rgba(214,229,255,0.95)] px-3 py-1 text-xs font-black text-[#2752a3]">
                      系统角色
                    </span>
                  </div>

                  <p className="text-sm font-bold text-[var(--foreground)]/68">{item.description || "暂无说明"}</p>

                  <div className="rounded-[18px] bg-white/72 px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]/48">权限范围</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.permissions || []).map((permission) => (
                        <span key={permission.id} className="rounded-full bg-[rgba(236,228,224,0.96)] px-3 py-1.5 text-xs font-black text-[var(--foreground)]/72">
                          {permission.description || permission.code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-6" />
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
      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">角色已统一</h2>
          <Link href="/system/roles" className="btn-subtle inline-flex rounded-full px-4 py-2 text-sm font-black">
            返回角色页
          </Link>
        </div>
        <p className="mt-6 text-sm font-bold leading-7 text-[var(--foreground)]/68">
          当前系统已经按 sharefrontend 的真实用户体系统一为浏览者、创作者、管理员三种内建角色。用户角色调整请前往用户管理页面处理。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/system/users" className="btn-primary inline-flex rounded-full px-6 py-3 text-sm font-black">
            去用户管理
          </Link>
          <Link href="/system/roles" className="btn-subtle inline-flex rounded-full px-6 py-3 text-sm font-black">
            返回角色页
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
      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">角色已统一</h2>
          <Link href="/system/roles" className="btn-subtle inline-flex rounded-full px-4 py-2 text-sm font-black">
            返回角色页
          </Link>
        </div>
        <p className="mt-6 text-sm font-bold leading-7 text-[var(--foreground)]/68">
          这里展示的角色是系统内建角色，实际变更请在用户管理页面直接调整用户的角色。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/system/users" className="btn-primary inline-flex rounded-full px-6 py-3 text-sm font-black">
            去用户管理
          </Link>
          <Link href="/system/roles" className="btn-subtle inline-flex rounded-full px-6 py-3 text-sm font-black">
            返回角色页
          </Link>
        </div>
      </section>
    </SystemWorkspace>
  );
}

function SystemLoadingPage({ currentPath, text }: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="dream-panel px-6 py-8">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">
          当前账号不是系统初始化超级管理员，无法访问此页面。
        </p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">{message}</p>;
}
