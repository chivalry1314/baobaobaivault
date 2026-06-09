"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareUserRole, ShareUserRoleManageItem } from "@/lib/shared";

const PAGE_SIZE = 10;

export function ShareSystemUsersPage() {
  const { user, sessionChecking, setUser } = useShareSession();
  const [items, setItems] = useState<ShareUserRoleManageItem[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | ShareUserRole>("all");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [submittedRoleFilter, setSubmittedRoleFilter] = useState<"all" | ShareUserRole>("all");
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatePendingByUser, setUpdatePendingByUser] = useState<Record<string, boolean>>({});
  const [deletePendingByUser, setDeletePendingByUser] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadUsers(1, submittedSearch, submittedRoleFilter);
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  async function loadUsers(nextPage: number, keyword: string, role: "all" | ShareUserRole) {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemUsers({
        page: nextPage,
        pageSize: PAGE_SIZE,
        keyword,
        role,
      });
      setItems(response.users || []);
      setTotal(response.pagination?.total || 0);
      setPage(response.pagination?.page || nextPage);
      setPageSize(response.pagination?.pageSize || PAGE_SIZE);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载用户列表失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRole(targetUser: ShareUserRoleManageItem, nextRole: ShareUserRole) {
    if (!user || targetUser.role === nextRole || updatePendingByUser[targetUser.id]) {
      return;
    }
    if (targetUser.id === user.id && nextRole !== "manager") {
      setActionError("不能将自己的角色降级为非管理员。");
      return;
    }

    setActionError("");
    setUpdatePendingByUser((current) => ({ ...current, [targetUser.id]: true }));

    try {
      const payload = await shareApi.updateSystemUserRole(targetUser.id, nextRole);
      setItems((current) =>
        current.map((item) => (item.id === targetUser.id ? { ...item, role: payload.user.role } : item)),
      );
      if (targetUser.id === user.id) {
        setUser(payload.user);
      }
    } catch (error) {
      setActionError(getShareErrorMessage(error, "更新用户角色失败，请稍后重试。"));
    } finally {
      setUpdatePendingByUser((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });
    }
  }

  async function handleDeleteUser(targetUser: ShareUserRoleManageItem) {
    if (!user || targetUser.id === user.id || deletePendingByUser[targetUser.id]) {
      return;
    }

    const displayName = targetUser.nickname.trim() || targetUser.username.trim() || targetUser.email;
    const confirmed = window.confirm(`确认要注销用户“${displayName}”吗？该操作会逻辑删除账号，并将其卡片转为私有归档。`);
    if (!confirmed) {
      return;
    }

    setActionError("");
    setDeletePendingByUser((current) => ({ ...current, [targetUser.id]: true }));

    try {
      await shareApi.deleteSystemUser(targetUser.id);
      await loadUsers(Math.min(page, Math.max(1, Math.ceil(Math.max(total - 1, 0) / pageSize))), submittedSearch, submittedRoleFilter);
    } catch (error) {
      setActionError(getShareErrorMessage(error, "注销用户失败，请稍后重试。"));
    } finally {
      setDeletePendingByUser((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });
    }
  }

  if (sessionChecking) {
    return <SystemLoadingPage currentPath="/system/users" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/users" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/users" />;
  }

  async function handleSubmitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = search.trim();
    setSubmittedSearch(nextKeyword);
    setSubmittedRoleFilter(roleFilter);
    await loadUsers(1, nextKeyword, roleFilter);
  }

  async function handlePageChange(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    await loadUsers(nextPage, submittedSearch, submittedRoleFilter);
  }

  return (
    <SystemWorkspace
      currentPath="/system/users"
      title="用户管理"
      description="集中管理站点用户角色。你可以筛选用户、调整浏览者 / 创作者 / 管理员权限，并对指定用户执行注销。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">站点用户</h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              第 {safePage} / {totalPages} 页，共 {total} 个匹配用户
            </p>
          </div>

          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleSubmitFilters}>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">搜索用户</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按邮箱、用户名、昵称或角色搜索"
                className="dream-input w-full px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">角色筛选</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | ShareUserRole)}
                className="dream-input w-full px-4 py-3"
              >
                <option value="all">全部角色</option>
                <option value="viewer">浏览者</option>
                <option value="creator">创作者</option>
                <option value="manager">管理员</option>
              </select>
            </label>

            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full rounded-full px-5 py-3 text-sm font-black lg:w-auto">
                应用筛选
              </button>
            </div>
          </form>
        </div>

        <div className="mt-5 divide-y divide-dashed divide-[var(--outline-variant)]/65">
          {loading ? (
            <p className="py-4 text-sm font-bold text-[var(--foreground)]/65">正在加载用户列表...</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-sm font-bold text-[var(--foreground)]/65">
              {submittedSearch || submittedRoleFilter !== "all" ? "没有符合筛选条件的用户。" : "暂时没有可管理用户。"}
            </p>
          ) : (
            items.map((item) => {
              const displayName = item.nickname.trim() || item.username.trim() || item.email;
              const updating = Boolean(updatePendingByUser[item.id]);
              const deleting = Boolean(deletePendingByUser[item.id]);
              const isSelf = item.id === user.id;

              return (
                <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[1.05rem] font-black text-[var(--foreground)]">
                        {displayName}
                        {isSelf ? "（我）" : ""}
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/72">
                        {roleLabel(item.role)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--foreground)]/58">{item.email}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--foreground)]/52">
                      用户名：{item.username || "-"} · 状态：{item.status || "active"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <RoleChip active={item.role === "viewer"} disabled={updating || deleting || isSelf} onClick={() => void handleUpdateRole(item, "viewer")}>
                      浏览者
                    </RoleChip>
                    <RoleChip active={item.role === "creator"} disabled={updating || deleting || isSelf} onClick={() => void handleUpdateRole(item, "creator")}>
                      创作者
                    </RoleChip>
                    <RoleChip active={item.role === "manager"} disabled={updating || deleting} onClick={() => void handleUpdateRole(item, "manager")}>
                      管理员
                    </RoleChip>
                    {!isSelf ? (
                      <button
                        type="button"
                        disabled={updating || deleting}
                        onClick={() => void handleDeleteUser(item)}
                        className="rounded-full border border-[#ef9a9a] bg-[#fff2f1] px-3.5 py-2 text-xs font-black text-[#b42318] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting ? "注销中..." : "注销用户"}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-[var(--foreground)]/55">本人不可降级或注销</span>
                    )}
                    {updating ? <span className="text-xs font-bold text-[var(--foreground)]/55">更新中...</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-6" />
      </section>
    </SystemWorkspace>
  );
}

function roleLabel(role: ShareUserRole) {
  switch (role) {
    case "manager":
      return "管理员";
    case "creator":
      return "创作者";
    default:
      return "浏览者";
  }
}

function RoleChip(props: { active: boolean; disabled: boolean; onClick: () => void; children: string }) {
  const { active, disabled, onClick, children } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-[var(--foreground)] text-white" : "btn-subtle text-[var(--foreground)]/72"
      }`}
    >
      {children}
    </button>
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
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">{message}</p>;
}
