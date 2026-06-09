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

export function CreatorCard({ item }: { item: DashboardCard }) {
  const rank = getCardRank(item);
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const accessCodeHref = `/creator/cards/${encodeURIComponent(item.card.id)}/access-code`;
  const accessCode = item.accessCode?.trim() ?? "";
  const hasInlineAccessCode = accessCode.length > 0;
  const accessCodeValue = hasInlineAccessCode
    ? accessCode
    : item.hasAccessCode
      ? "已配置"
      : "未配置";

  return (
    <article className="dream-panel-soft flex h-full flex-col overflow-hidden rounded-[18px] p-1.5 shadow-[0_14px_30px_-26px_rgba(71,102,129,0.24)]">
      <div className="relative overflow-hidden rounded-[14px] bg-[rgba(244,249,252,0.94)] p-2">
        <div className="absolute inset-x-2.5 top-2 flex items-center justify-between">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${rank.className}`}
          >
            {rank.label}
          </span>
          <div className="flex gap-2">
            <span className="inline-flex rounded-full bg-white/88 px-2 py-0.5 text-[9px] font-black text-[var(--foreground)]/62">
              #{formatCardCode(item.card.id)}
            </span>
          </div>
        </div>

        <div className="pt-5">
          {isImageCard(item.card) ? (
            <div className="overflow-hidden rounded-[12px] border border-white/80 bg-white shadow-[0_14px_30px_-28px_rgba(83,110,122,0.4)]">
              <img
                src={item.card.previewUrl}
                alt={item.card.title}
                className="h-20 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-20 items-end rounded-[12px] border border-dashed border-[var(--outline-variant)] bg-[linear-gradient(135deg,rgba(209,234,247,0.36),rgba(246,223,233,0.34))] p-2">
              <p className="max-w-[12rem] text-[9px] leading-3.5 text-[var(--foreground)]/66">
                {defaultCardDescription(item.card)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-1.5">
        <div className="min-w-0">
          <h2 className="line-clamp-1 text-[13px] font-black leading-[1.15] text-[var(--foreground)]">
            {item.card.title}
          </h2>
          <p className="sr-only">
            {defaultCardDescription(item.card)}
          </p>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          <AccessModeBadge mode={item.card.accessMode} compact />
          <StatusBadge>{getVisibilityLabel(item.card.visibility)}</StatusBadge>
          <StatusBadge>{getStatusLabel(item.card.status)}</StatusBadge>
          <StatusBadge>{getReviewStatusLabel(item.card.reviewStatus)}</StatusBadge>
        </div>

        <dl className="mt-2 grid grid-cols-3 gap-1">
          <StatCard label="下载" value={String(item.stats.downloadCount)} />
          <StatCard
            label="更新"
            value={formatDate(item.card.updatedAt)}
            compact
          />
          <StatCard
            label="提取码"
            value={accessCodeValue}
            title={hasInlineAccessCode ? accessCode : accessCodeValue}
            compact
            mono={hasInlineAccessCode}
          />
        </dl>

        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          <Link
            href={editHref}
            className="btn-primary inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-2 py-1 text-[10px] font-black"
          >
            编辑卡片
          </Link>
          <Link
            href={accessCodeHref}
            className="btn-subtle inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-2 py-1 text-[10px] font-black text-[var(--foreground)]/74"
          >
            管理提取码
          </Link>
        </div>
      </div>
    </article>
  );
}

export function HistoryItem({ item }: { item: DashboardCard }) {
  return (
    <div className="dream-panel-soft flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black text-[var(--foreground)]">
            {item.card.title}
          </h3>
          <AccessModeBadge mode={item.card.accessMode} />
        </div>
        <p className="mt-2 text-sm text-[var(--foreground)]/62">
          最近更新于 {formatDate(item.card.updatedAt)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge>{getVisibilityLabel(item.card.visibility)}</StatusBadge>
        <StatusBadge>{getStatusLabel(item.card.status)}</StatusBadge>
        <StatusBadge>{getReviewStatusLabel(item.card.reviewStatus)}</StatusBadge>
      </div>
    </div>
  );
}

function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-white/86 px-1.5 py-0.5 text-[8px] font-black text-[var(--foreground)]/66">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  title,
  compact = false,
  mono = false,
}: {
  label: string;
  value: string;
  title?: string;
  compact?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-[54px] flex-col justify-between rounded-[11px] bg-white/78 px-1 py-1.5 text-center">
      <dt className="text-[8px] font-black uppercase tracking-[0.06em] text-[var(--foreground)]/42">
        {label}
      </dt>
      <dd
        title={title}
        className={`mt-2 font-black text-[var(--foreground)] ${
          compact ? "text-[9px] leading-3.5" : "text-[13px]"
        } ${mono ? "font-mono tracking-[0.04em]" : ""}`}
      >
        <span className="block truncate">
          {value}
        </span>
      </dd>
    </div>
  );
}

export const CreatorStudioIcons = {
  HomeIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.8V21h13V9.8" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  },
  CardIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18" />
        <path d="M8 15h4" />
      </svg>
    );
  },
  KeyIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <circle cx="7.5" cy="12.5" r="3.5" />
        <path d="M11 12.5h10" />
        <path d="M17 12.5v3" />
        <path d="M14 12.5v2" />
      </svg>
    );
  },
  ReviewIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14.5a2.5 2.5 0 0 0-2.5-2.5H4z" />
        <path d="M6.5 21A2.5 2.5 0 0 1 4 18.5V5.5" />
        <path d="M8 8h8" />
        <path d="M8 12h6" />
      </svg>
    );
  },
  SettingsIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M12 8.4A3.6 3.6 0 1 0 12 15.6A3.6 3.6 0 1 0 12 8.4z" />
        <path d="m19.4 15 .2 2.2-2 1.2-1.8-1a7.8 7.8 0 0 1-1.9.8l-.6 2h-2.4l-.6-2a7.8 7.8 0 0 1-1.9-.8l-1.8 1-2-1.2.2-2.2a7.7 7.7 0 0 1-1.3-1.6L2.2 11l1.8-1.2a7.7 7.7 0 0 1 1.3-1.6l-.2-2.2 2-1.2 1.8 1c.6-.3 1.2-.6 1.9-.8l.6-2h2.4l.6 2c.7.2 1.3.5 1.9.8l1.8-1 2 1.2-.2 2.2c.5.5.9 1 1.3 1.6L21.8 11 20 12.2c-.3.6-.8 1.1-1.3 1.6Z" />
      </svg>
    );
  },
  PlusIcon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  },
};
