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
  const [actionNotice, setActionNotice] = useState("");
  const [updatePendingByUser, setUpdatePendingByUser] = useState<Record<string, boolean>>({});
  const [deletePendingByUser, setDeletePendingByUser] = useState<Record<string, boolean>>({});
  const [resetPendingByUser, setResetPendingByUser] = useState<Record<string, boolean>>({});

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
    setActionNotice("");
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
    setActionNotice("");
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

  async function handleResetPassword(targetUser: ShareUserRoleManageItem) {
    if (!user || targetUser.id === user.id || resetPendingByUser[targetUser.id]) {
      return;
    }

    const displayName = targetUser.nickname.trim() || targetUser.username.trim() || targetUser.email;
    const confirmed = window.confirm(`确认要为用户“${displayName}”重置密码吗？系统会生成一个新的随机密码。`);
    if (!confirmed) {
      return;
    }

    setActionError("");
    setActionNotice("");
    setResetPendingByUser((current) => ({ ...current, [targetUser.id]: true }));

    try {
      const response = await shareApi.resetSystemUserPassword(targetUser.id);
      let copied = false;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(response.newPassword);
          copied = true;
        } catch {
          copied = false;
        }
      }

      setActionNotice(
        copied
          ? `已重置“${displayName}”的密码，新密码已复制到剪贴板：${response.newPassword}`
          : `已重置“${displayName}”的密码，请立即复制并发给用户：${response.newPassword}`,
      );
    } catch (error) {
      setActionError(getShareErrorMessage(error, "重置用户密码失败，请稍后重试。"));
    } finally {
      setResetPendingByUser((current) => {
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
      {actionNotice ? <SuccessNotice message={actionNotice} /> : null}

      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        <div className="border-b border-[var(--outline)]/20 pb-3">
          <h2 className="text-base font-black text-[var(--foreground)]">站点用户</h2>
          <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
            第 {safePage} / {totalPages} 页，共 {total} 个匹配用户
          </p>
        </div>

        <form className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSubmitFilters}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">搜索用户</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按邮箱、用户名、昵称或角色搜索"
              className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">角色筛选</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | ShareUserRole)}
              className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none"
            >
              <option value="all">全部角色</option>
              <option value="viewer">浏览者</option>
              <option value="creator">创作者</option>
              <option value="manager">管理员</option>
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
            <p className="text-xs font-bold text-[var(--foreground)]/55">正在加载用户列表...</p>
          ) : items.length === 0 ? (
            <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-5 text-center">
              <p className="text-xs font-black text-[var(--foreground)]/60">
                {submittedSearch || submittedRoleFilter !== "all" ? "没有符合筛选条件的用户。" : "暂时没有可管理用户。"}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const displayName = item.nickname.trim() || item.username.trim() || item.email;
              const updating = Boolean(updatePendingByUser[item.id]);
              const deleting = Boolean(deletePendingByUser[item.id]);
              const resetting = Boolean(resetPendingByUser[item.id]);
              const isSelf = item.id === user.id;
              const actionPending = updating || deleting || resetting;

              return (
                <article key={item.id} className="rounded-[1.1rem] border-2 border-[var(--outline)] bg-white p-3 shadow-sm transition hover:shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-black text-[var(--foreground)]">
                          {displayName}
                          {isSelf ? "（我）" : ""}
                        </p>
                        <span className="rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] font-black text-[var(--foreground)]/72">
                          {roleLabel(item.role)}
                        </span>
                        {item.forcePasswordChange ? (
                          <span className="rounded-full border border-[#f3c8ad] bg-[#fff4ec] px-1.5 py-0.5 text-[10px] font-black text-[#9a3412]">
                            下次登录需改密
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] font-bold text-[var(--foreground)]/50">
                        <span className="truncate">{item.email}</span>
                        <span className="text-[var(--outline)]">·</span>
                        <span>@{item.username || "-"}</span>
                        <span className="text-[var(--outline)]">·</span>
                        <span>{item.status || "active"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <RoleChip active={item.role === "viewer"} disabled={actionPending || isSelf} onClick={() => void handleUpdateRole(item, "viewer")}>
                        浏览者
                      </RoleChip>
                      <RoleChip active={item.role === "creator"} disabled={actionPending || isSelf} onClick={() => void handleUpdateRole(item, "creator")}>
                        创作者
                      </RoleChip>
                      <RoleChip active={item.role === "manager"} disabled={actionPending} onClick={() => void handleUpdateRole(item, "manager")}>
                        管理员
                      </RoleChip>
                      {!isSelf ? (
                        <>
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void handleResetPassword(item)}
                            className="rounded-full border border-[rgba(120,77,255,0.18)] bg-[rgba(120,77,255,0.08)] px-2.5 py-1 text-[10px] font-black text-[var(--foreground)] transition hover:bg-[rgba(120,77,255,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {resetting ? "重置中..." : "重置密码"}
                          </button>
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void handleDeleteUser(item)}
                            className="rounded-full border border-[#ef9a9a] bg-[#fff2f1] px-2.5 py-1 text-[10px] font-black text-[#b42318] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleting ? "注销中..." : "注销用户"}
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-[var(--foreground)]/55">本人不可降级、重置或注销</span>
                      )}
                      {updating ? <span className="text-[10px] font-bold text-[var(--foreground)]/55">更新中...</span> : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={(nextPage) => void handlePageChange(nextPage)} className="mt-4" />
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
      className={`rounded-full px-2 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "bg-[var(--button-primary)] text-[var(--foreground)] shadow-sm"
          : "border border-[var(--outline)]/20 bg-white text-[var(--foreground)]/72 hover:bg-[var(--surface-container)]"
      }`}
    >
      {children}
    </button>
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
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">{message}</p>;
}

function SuccessNotice({ message }: { message: string }) {
  return <p className="rounded-[1.1rem] border border-[#b7dfc8] bg-[#effaf3] px-4 py-3 text-xs font-black text-[#166534]">{message}</p>;
}
