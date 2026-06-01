import Link from "next/link";
import type { ReactNode } from "react";

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
import type { DashboardCard, ExternalSessionUser } from "@/lib/shared";

export function Avatar({ user, size = "lg" }: { user: ExternalSessionUser; size?: "sm" | "lg" }) {
  const name = getDisplayName(user);
  const dimension = size === "sm" ? "h-14 w-14" : "h-28 w-28";
  const inner = size === "sm" ? "text-lg" : "text-3xl";

  if (user.avatar.trim()) {
    return <img src={user.avatar} alt={name} className={`${dimension} rounded-full object-cover shadow-[0_16px_36px_-24px_rgba(120,85,94,0.5)]`} />;
  }

  return <div className={`${dimension} btn-subtle flex items-center justify-center rounded-full font-black shadow-[0_16px_36px_-24px_rgba(55,98,120,0.35)] ${inner}`}>{getInitials(name)}</div>;
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
    active ? "btn-subtle text-[var(--primary)] shadow-[0_18px_36px_-26px_rgba(57,124,153,0.35)]" : "text-[var(--foreground)]/74 hover:bg-white/78 hover:text-[var(--primary)]"
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

export function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-h3 border-b-2 pb-4 transition ${active ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"}`}
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
      <p className="type-body-sm mx-auto mt-3 max-w-xl text-[var(--foreground)]/62">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-black">
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn-primary mt-6 rounded-full px-6 py-3 text-sm font-black">
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

  return (
    <article className="dream-panel p-4">
      <Link href={editHref} className="relative block overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#20161a_0%,#3f2b32_100%)]">
        {isImageCard(item.card) ? (
          <img src={item.card.previewUrl} alt={item.card.title} className="h-[212px] w-full object-cover" />
        ) : (
          <div className="flex h-[212px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] px-4 text-center text-lg font-black text-white/92">{item.card.title}</div>
        )}
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-black ${rank.className}`}>{rank.label}</span>
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
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">{getVisibilityLabel(item.card.visibility)}</span>
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">{getReviewStatusLabel(item.card.reviewStatus)}</span>
          </div>
        </div>
        <p className="type-body-sm mt-2 line-clamp-2 min-h-[3rem] text-[var(--foreground)]/72">{defaultCardDescription(item.card)}</p>
      </div>

      <div className="mt-3 border-t border-dashed border-[var(--outline-variant)] pt-3">
        <div className="dream-panel-soft px-3.5 py-3">
          {hasInlineAccessCode ? (
            <div className="flex items-center justify-between gap-3">
              <code className="max-w-[70%] truncate rounded-full border border-[var(--outline-variant)] bg-white/65 px-3 py-1 text-sm font-black tracking-[0.12em] text-[var(--primary)]">{accessCode}</code>
              <Link href={accessCodeHref} className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]">
                去管理
              </Link>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="type-body-sm tracking-[0.06em] text-[var(--primary)]">未配置</div>
                <div className="mt-1 text-xs text-[var(--text-subtle)]">点击右侧按钮进入提取码管理</div>
              </div>
              <Link href={accessCodeHref} className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]">
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
        <Link href={editHref} className="block h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)]">
          {isImageCard(item.card) ? (
            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm font-black text-white/92">{item.card.title}</div>
          )}
        </Link>

        <div className="min-w-0">
          <Link href={editHref} className="block truncate text-xl font-black text-[var(--foreground)]">
            {item.card.title}
          </Link>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">
            更新时间：{formatDate(item.card.updatedAt)}，当前状态：{getStatusLabel(item.card.status)} / {getReviewStatusLabel(item.card.reviewStatus)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <span className="dream-chip px-3 py-1">{getVisibilityLabel(item.card.visibility)}</span>
            <span className="dream-chip px-3 py-1">下载 {item.stats.downloadCount} 次</span>
            <span className="dream-chip px-3 py-1">编号 {formatCardCode(item.card.id)}</span>
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
} as const;

function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 3.75 3.75 10.3V20.25h5.25V14.5h6v5.75h5.25V10.3L12 3.75Z" fill="currentColor" />
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
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12h-5.25v-1.5h5.25V5.25Z" fill="currentColor" />
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
