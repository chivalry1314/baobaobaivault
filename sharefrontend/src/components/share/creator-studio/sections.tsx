import Link from "next/link";
import type { ReactNode } from "react";

import { AccessModeBadge } from "@/components/share/access-mode-badge";
import {
  defaultCardDescription,
  formatCardCode,
  formatDate,
  getCardRank,
  getDisplayName,
  getInitials,
  getReviewStatusLabel,
  getStatusLabel,
  getVisibilityLabel,
  isImageCard,
} from "@/components/share/creator-studio/helpers";
import type {
  DashboardCard,
  ExternalSessionUser,
  ShareAuthSettings,
  ShareEmailHealth,
  ShareUserRole,
  ShareUserRoleManageItem,
} from "@/lib/shared";

export function Avatar({
  user,
  size = "lg",
}: {
  user: ExternalSessionUser;
  size?: "sm" | "lg";
}) {
  const name = getDisplayName(user);
  const dimension = size === "sm" ? "h-14 w-14" : "h-28 w-28";
  const inner = size === "sm" ? "text-lg" : "text-3xl";

  if (user.avatar.trim()) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className={`${dimension} rounded-full object-cover shadow-[0_16px_36px_-24px_rgba(120,85,94,0.5)]`}
      />
    );
  }

  return (
    <div
      className={`${dimension} btn-subtle flex items-center justify-center rounded-full font-black shadow-[0_16px_36px_-24px_rgba(55,98,120,0.35)] ${inner}`}
    >
      {getInitials(name)}
    </div>
  );
}

export function SidebarButton({
  active = false,
  href,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className = `flex w-full items-center gap-3 rounded-full px-5 py-4 text-base font-black transition ${
    active
      ? "btn-subtle text-[var(--primary)] shadow-[0_18px_36px_-26px_rgba(57,124,153,0.35)]"
      : "text-[var(--foreground)]/74 hover:bg-white/78 hover:text-[var(--primary)]"
  }`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-h3 border-b-2 pb-4 transition ${
        active
          ? "border-[var(--primary)] text-[var(--foreground)]"
          : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="dream-panel px-6 py-14 text-center">
      <p className="type-h2 text-[var(--foreground)]">{title}</p>
      <p className="type-body-sm mx-auto mt-3 max-w-xl text-[var(--foreground)]/62">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-black"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary mt-6 rounded-full px-6 py-3 text-sm font-black"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function InfoPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="dream-panel px-6 py-6 sm:px-8 sm:py-8">
      <div className="border-b border-[rgba(220,173,187,0.35)] pb-5">
        <h1 className="text-[1.65rem] font-black text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

export function EmailVerificationSettingsPanel({
  emailVerificationEnabled,
  authSettings,
  authSettingsDraft,
  authSettingsPending,
  authSettingsMessage,
  emailHealth,
  smtpTestPending,
  smtpTestMessage,
  smtpTestTargetEmail,
  setSMTPTestTargetEmail,
  onAuthSettingsChange,
  onSaveAuthSettings,
  onSMTPTest,
}: {
  emailVerificationEnabled: boolean;
  authSettings: ShareAuthSettings | null;
  authSettingsDraft: ShareAuthSettings | null;
  authSettingsPending: boolean;
  authSettingsMessage: string;
  emailHealth: ShareEmailHealth | null;
  smtpTestPending: boolean;
  smtpTestMessage: string;
  smtpTestTargetEmail: string;
  setSMTPTestTargetEmail: (value: string) => void;
  onAuthSettingsChange: (patch: Partial<ShareAuthSettings>) => void;
  onSaveAuthSettings: () => void;
  onSMTPTest: () => void;
}) {
  const canEditAuthSettings = Boolean(authSettings?.canUpdate && authSettingsDraft);

  return (
    <div className="dream-panel-soft overflow-hidden">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                emailVerificationEnabled ? "bg-[#0f9d77]" : "bg-[#f0a33e]"
              }`}
            />
            <p className="text-[1.1rem] font-black text-[var(--foreground)]">
              邮箱验证状态
            </p>
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
            {emailVerificationEnabled
              ? "当前已开启邮箱验证码注册，新用户需要先完成邮箱验证后才能创建账号。"
              : "当前未开启邮箱验证码注册，新用户注册成功后会直接创建账号并登录。"}
          </p>
        </div>

        <button
          type="button"
          onClick={onSMTPTest}
          disabled={smtpTestPending}
          className="btn-subtle self-end rounded-full px-5 py-2.5 text-sm font-black text-[var(--foreground)]/76 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          {smtpTestPending ? "发送中..." : "发送 SMTP 测试邮件"}
        </button>
      </div>

      <div className="dream-divider border-t border-dashed" />

      <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-[var(--foreground)]">
            注册必须邮箱激活
          </span>
          <select
            value={authSettingsDraft?.emailVerificationEnabled ? "enabled" : "disabled"}
            onChange={(event) =>
              onAuthSettingsChange({
                emailVerificationEnabled: event.target.value === "enabled",
              })
            }
            disabled={!canEditAuthSettings || authSettingsPending}
            className="dream-input mt-3 w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="enabled">开启</option>
            <option value="disabled">关闭</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--foreground)]">
            验证码有效期（秒）
          </span>
          <input
            type="number"
            min={300}
            max={1800}
            step={30}
            value={authSettingsDraft?.verificationCodeTTLSeconds ?? 600}
            onChange={(event) =>
              onAuthSettingsChange({
                verificationCodeTTLSeconds: Number(event.target.value) || 0,
              })
            }
            disabled={!canEditAuthSettings || authSettingsPending}
            className="dream-input mt-3 w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--foreground)]">
            重发间隔（秒）
          </span>
          <input
            type="number"
            min={30}
            max={300}
            step={5}
            value={authSettingsDraft?.resendIntervalSeconds ?? 60}
            onChange={(event) =>
              onAuthSettingsChange({
                resendIntervalSeconds: Number(event.target.value) || 0,
              })
            }
            disabled={!canEditAuthSettings || authSettingsPending}
            className="dream-input mt-3 w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--foreground)]">
            最大验证次数
          </span>
          <input
            type="number"
            min={3}
            max={10}
            step={1}
            value={authSettingsDraft?.maxVerifyAttempts ?? 5}
            onChange={(event) =>
              onAuthSettingsChange({
                maxVerifyAttempts: Number(event.target.value) || 0,
              })
            }
            disabled={!canEditAuthSettings || authSettingsPending}
            className="dream-input mt-3 w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="px-5 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold leading-6 text-[var(--text-muted)]">
            仅系统初始化超级管理员可修改。建议：有效期 300-1800 秒，重发间隔 30-300 秒，且必须小于有效期。
          </p>
          <button
            type="button"
            onClick={onSaveAuthSettings}
            disabled={!canEditAuthSettings || authSettingsPending}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authSettingsPending ? "保存中..." : "保存邮箱注册策略"}
          </button>
        </div>
        {authSettingsMessage ? (
          <p className="mt-3 text-sm font-bold text-[var(--foreground)]/72">
            {authSettingsMessage}
          </p>
        ) : null}
      </div>

      <div className="dream-divider border-t border-dashed" />

      <div className="px-5 py-5">
        <label className="block">
          <span className="text-sm font-black text-[var(--foreground)]">
            测试收件邮箱
          </span>
          <input
            type="email"
            value={smtpTestTargetEmail}
            onChange={(event) => setSMTPTestTargetEmail(event.target.value)}
            className="dream-input mt-3 w-full px-4 py-3"
            placeholder="请输入要接收测试邮件的邮箱"
          />
        </label>
      </div>

      <div className="dream-divider border-t border-dashed" />

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-3">
        <MetricCard
          label="SMTP 服务"
          value={emailHealth?.enabled ? "已启用" : "未启用"}
        />
        <MetricCard
          label="发件地址"
          value={emailHealth?.fromAddress || "未配置"}
          breakAll
        />
        <MetricCard
          label="SMTP 主机"
          value={`${emailHealth?.smtpHost || "未配置"}${
            emailHealth && emailHealth.smtpPort > 0
              ? `:${emailHealth.smtpPort}`
              : ""
          }`}
          breakAll
        />
      </div>

      {smtpTestMessage ? (
        <>
          <div className="dream-divider border-t border-dashed" />
          <div className="px-5 py-4 text-sm font-bold text-[var(--foreground)]/70">
            {smtpTestMessage}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function UserManagementPanel({
  currentUserId,
  roleUsers,
  totalUsers,
  roleLoadPending,
  roleLoadError,
  roleUpdatePendingByUser,
  roleDeletePendingByUser,
  onUpdateRole,
  onDeleteUser,
  paginationSlot,
}: {
  currentUserId: string;
  roleUsers: ShareUserRoleManageItem[];
  totalUsers: number;
  roleLoadPending: boolean;
  roleLoadError: string;
  roleUpdatePendingByUser: Record<string, boolean>;
  roleDeletePendingByUser: Record<string, boolean>;
  onUpdateRole: (
    targetUser: ShareUserRoleManageItem,
    nextRole: ShareUserRole,
  ) => Promise<void>;
  onDeleteUser: (targetUser: ShareUserRoleManageItem) => Promise<void>;
  paginationSlot?: ReactNode;
}) {
  return (
    <div className="dream-panel-soft overflow-hidden">
      {roleLoadError ? (
        <p className="border-b border-dashed border-[#f3c8ad] bg-[#fff4ec] px-5 py-3 text-sm text-[#9a3412]">
          {roleLoadError}
        </p>
      ) : null}

      {roleLoadPending ? (
        <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">
          正在加载用户列表...
        </p>
      ) : null}

      {!roleLoadPending && totalUsers === 0 ? (
        <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">
          暂无可管理用户
        </p>
      ) : null}

      {!roleLoadPending && totalUsers > 0 ? (
        <>
          <div className="divide-y divide-dashed divide-[var(--outline-variant)]/65">
            {roleUsers.map((item) => {
              const displayName =
                item.nickname.trim() || item.username.trim() || item.email;
              const pending = Boolean(roleUpdatePendingByUser[item.id]);
              const deletePending = Boolean(roleDeletePendingByUser[item.id]);
              const isSelf = item.id === currentUserId;

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[1.05rem] font-black text-[var(--foreground)]">
                      {displayName}
                      {isSelf ? "（我）" : ""}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {item.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <UserRoleChip
                      active={item.role === "viewer"}
                      disabled={pending || deletePending || isSelf}
                      onClick={() => void onUpdateRole(item, "viewer")}
                    >
                      浏览者
                    </UserRoleChip>
                    <UserRoleChip
                      active={item.role === "creator"}
                      disabled={pending || deletePending || isSelf}
                      onClick={() => void onUpdateRole(item, "creator")}
                    >
                      创作者
                    </UserRoleChip>
                    <UserRoleChip
                      active={item.role === "manager"}
                      disabled={pending || deletePending}
                      onClick={() => void onUpdateRole(item, "manager")}
                    >
                      管理员
                    </UserRoleChip>
                    {!isSelf ? (
                      <button
                        type="button"
                        disabled={pending || deletePending}
                        onClick={() => void onDeleteUser(item)}
                        className="rounded-full border border-[#ef9a9a] bg-[#fff2f1] px-3.5 py-2 text-xs font-black text-[#b42318] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletePending ? "注销中..." : "注销用户"}
                      </button>
                    ) : null}
                    {isSelf ? (
                      <span className="text-xs font-bold text-[var(--text-muted)]">
                        本人不可降为创作者或浏览者
                      </span>
                    ) : null}
                    {pending ? (
                      <span className="text-xs font-bold text-[var(--text-muted)]">
                        更新中...
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {paginationSlot ? (
            <div className="border-t border-dashed border-[var(--outline-variant)]/65 px-5 py-4">
              {paginationSlot}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function CreatorCard({ item }: { item: DashboardCard }) {
  const rank = getCardRank(item);
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const accessCodeHref = `/creator/cards/${encodeURIComponent(item.card.id)}/access-code`;
  const accessCode = item.accessCode?.trim() ?? "";
  const hasInlineAccessCode = accessCode.length > 0;

  return (
    <article className="dream-panel p-4">
      <Link
        href={editHref}
        className="relative block overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#20161a_0%,#3f2b32_100%)]"
      >
        {isImageCard(item.card) ? (
          <img
            src={item.card.previewUrl}
            alt={item.card.title}
            className="h-[212px] w-full object-cover"
          />
        ) : (
          <div className="flex h-[212px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] px-4 text-center text-lg font-black text-white/92">
            {item.card.title}
          </div>
        )}
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-black ${rank.className}`}
        >
          {rank.label}
        </span>
        <span className="dream-chip absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-[var(--primary)]">
          <HeartIcon className="h-5 w-5" />
        </span>
      </Link>

      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={editHref} className="type-h2 block text-[var(--foreground)]">
              {item.card.title}
            </Link>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <AccessModeBadge mode={item.card.accessMode} compact />
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">
              {getVisibilityLabel(item.card.visibility)}
            </span>
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">
              {getReviewStatusLabel(item.card.reviewStatus)}
            </span>
          </div>
        </div>
        <p className="type-body-sm mt-2 line-clamp-2 min-h-[3rem] text-[var(--foreground)]/72">
          {defaultCardDescription(item.card)}
        </p>
      </div>

      <div className="mt-3 border-t border-dashed border-[var(--outline-variant)] pt-3">
        <div className="dream-panel-soft px-3.5 py-3">
          {hasInlineAccessCode ? (
            <div className="flex items-center justify-between gap-3">
              <code className="max-w-[70%] truncate rounded-full border border-[var(--outline-variant)] bg-white/65 px-3 py-1 text-sm font-black tracking-[0.12em] text-[var(--primary)]">
                {accessCode}
              </code>
              <Link
                href={accessCodeHref}
                className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]"
              >
                去管理
              </Link>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="type-body-sm tracking-[0.06em] text-[var(--primary)]">
                  未配置
                </div>
                <div className="mt-1 text-xs text-[var(--text-subtle)]">
                  点击右侧按钮进入提取码管理
                </div>
              </div>
              <Link
                href={accessCodeHref}
                className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]"
              >
                去管理
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function HistoryItem({ item }: { item: DashboardCard }) {
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  return (
    <article className="dream-panel-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={editHref}
          className="block h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)]"
        >
          {isImageCard(item.card) ? (
            <img
              src={item.card.previewUrl}
              alt={item.card.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm font-black text-white/92">
              {item.card.title}
            </div>
          )}
        </Link>

        <div className="min-w-0">
          <Link href={editHref} className="block truncate text-xl font-black text-[var(--foreground)]">
            {item.card.title}
          </Link>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">
            更新时间：{formatDate(item.card.updatedAt)}，当前状态：
            {getStatusLabel(item.card.status)} / {getReviewStatusLabel(item.card.reviewStatus)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <AccessModeBadge mode={item.card.accessMode} compact />
            <span className="dream-chip px-3 py-1">
              {getVisibilityLabel(item.card.visibility)}
            </span>
            <span className="dream-chip px-3 py-1">
              下载 {item.stats.downloadCount} 次
            </span>
            <span className="dream-chip px-3 py-1">
              编号 {formatCardCode(item.card.id)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export const CreatorStudioIcons = {
  HomeIcon,
  CardIcon,
  SettingsIcon,
  KeyIcon,
  HeartIcon,
  PlusIcon,
  ReviewIcon,
  UsersIcon,
} as const;

function MetricCard({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-[20px] bg-white/72 px-4 py-3">
      <div className="text-xs font-bold text-[var(--text-muted)]">{label}</div>
      <div
        className={`mt-1 text-sm font-black text-[var(--foreground)] ${
          breakAll ? "break-all" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function UserRoleChip({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
        active
          ? "btn-primary text-[var(--foreground)]"
          : "btn-subtle text-[var(--foreground)]/72"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75 3.75 10.3V20.25h5.25V14.5h6v5.75h5.25V10.3L12 3.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 4.5h9A3.75 3.75 0 0 1 20.25 8.25v7.5A3.75 3.75 0 0 1 16.5 19.5h-9a3.75 3.75 0 0 1-3.75-3.75v-7.5A3.75 3.75 0 0 1 7.5 4.5Zm0 1.5A2.25 2.25 0 0 0 5.25 8.25v.75h13.5v-.75A2.25 2.25 0 0 0 16.5 6h-9Zm11.25 4.5H5.25v5.25A2.25 2.25 0 0 0 7.5 18h9a2.25 2.25 0 0 0 2.25-2.25V10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3.75 1.07 1.94 2.2.39 1.56-1.6 1.59 1.58-1.61 1.6.4 2.2 1.89 1.09-.63 2.18-2.18-.02-1.55 1.59.38 2.18-2.11.85-1.01-1.93-2.19-.01-1.02 1.93-2.1-.85.38-2.18-1.55-1.59-2.18.02-.63-2.18 1.89-1.09.4-2.2-1.61-1.6 1.59-1.58 1.56 1.6 2.2-.39L12 3.75Zm0 5.25A3 3 0 1 0 12 15a3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function KeyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M13.5 6a4.5 4.5 0 1 0 3.96 6.64l4.79.01v1.5h-1.5v1.5h-1.5v1.5h-2.25V15.9h-1.33A4.5 4.5 0 0 0 13.5 6Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12h-5.25v-1.5h5.25V5.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ReviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M6.75 3.75h10.5A2.25 2.25 0 0 1 19.5 6v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Zm0 1.5a.75.75 0 0 0-.75.75v12c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H6.75Zm1.5 3h7.5v1.5h-7.5v-1.5Zm0 3.75h7.5v1.5h-7.5V12Zm0 3.75h4.5v1.5h-4.5v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M8.25 11.25a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm7.5-1.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm-7.5 3c-2.9 0-5.25 1.82-5.25 4.06 0 .38.3.69.68.69h9.14c.38 0 .68-.31.68-.69 0-2.24-2.35-4.06-5.25-4.06Zm7.5.75c-.76 0-1.48.12-2.13.34 1.03.83 1.69 1.93 1.84 3.16h4.13c.36 0 .66-.29.66-.66 0-1.58-1.99-2.84-4.5-2.84Z"
        fill="currentColor"
      />
    </svg>
  );
}
