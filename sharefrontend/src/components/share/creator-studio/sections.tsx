import Link from "next/link";
import type { ReactNode } from "react";

import { AccessModeBadge } from "@/components/share/access-mode-badge";
import { FavoriteButton } from "@/components/share/favorite-button";
import { ShareImage } from "@/components/share/share-image";
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
  FavoriteItem,
} from "@/lib/shared";

export function Avatar({
  user,
  size = "lg",
}: {
  user: ExternalSessionUser;
  size?: "sm" | "lg";
}) {
  const name = getDisplayName(user);
  const dimension = size === "sm" ? "h-11 w-11" : "h-20 w-20";
  const inner = size === "sm" ? "text-sm" : "text-xl";

  if (user.avatar.trim()) {
    return (
      <ShareImage
        src={user.avatar}
        alt={name}
        className={`${dimension} rounded-full object-cover shadow-[0_12px_28px_-20px_rgba(120,85,94,0.45)]`}
      />
    );
  }

  return (
    <div
      className={`${dimension} flex items-center justify-center rounded-full border-2 border-[var(--outline)] bg-[var(--primary)] font-black text-[var(--foreground)] shadow-[0_12px_28px_-20px_rgba(55,98,120,0.35)] ${inner}`}
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
  const className = `flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-xs font-black transition ${
    active
      ? "bg-[var(--surface-container-high)] text-[var(--foreground)] shadow-sm"
      : "text-[var(--foreground)]/74 hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
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
      className={`border-b-2 pb-3 text-sm font-black transition ${
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
    <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-6 py-12 text-center shadow-sm">
      <p className="text-lg font-black text-[var(--foreground)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-xs font-bold text-[var(--foreground)]/62">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-5 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-5 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
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
  const isDelisted = item.card.status === "delisted";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.1rem] border border-[var(--outline)]/20 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <Link href={editHref} className="relative block aspect-[3/2] w-full overflow-hidden bg-[var(--surface-container)]">
        {isImageCard(item.card) ? (
          <ShareImage
            src={item.card.previewUrl}
            alt={item.card.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-end p-3">
            <p className="line-clamp-2 text-[10px] leading-4 text-[var(--foreground)]/66">
              {defaultCardDescription(item.card)}
            </p>
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${rank.className}`}>
            {rank.label}
          </span>
        </div>
        <span className="absolute right-2.5 top-2.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2 py-0.5 text-[9px] font-black text-white/95 backdrop-blur-sm">
          #{formatCardCode(item.card.id)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="min-w-0">
          <h2 className="line-clamp-1 text-sm font-black text-[var(--foreground)]">
            <Link href={editHref}>{item.card.title}</Link>
          </h2>
          <p className="sr-only">{defaultCardDescription(item.card)}</p>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <AccessModeBadge mode={item.card.accessMode} compact />
          <StatusBadge>{getVisibilityLabel(item.card.visibility)}</StatusBadge>
          {isDelisted ? (
            <DelistedBadge>{getStatusLabel(item.card.status)}</DelistedBadge>
          ) : (
            <StatusBadge>{getStatusLabel(item.card.status)}</StatusBadge>
          )}
          <StatusBadge>{getReviewStatusLabel(item.card.reviewStatus)}</StatusBadge>
        </div>

        <div className="mt-2.5 flex items-center gap-3 text-[10px] font-bold text-[var(--foreground)]/60">
          <span className="inline-flex items-center gap-1">
            <DownloadMiniIcon className="h-3 w-3" />
            {item.stats.downloadCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarMiniIcon className="h-3 w-3" />
            {formatDate(item.card.updatedAt)}
          </span>
          <span
            className="inline-flex items-center gap-1"
            title={hasInlineAccessCode ? accessCode : accessCodeValue}
          >
            <KeyMiniIcon className="h-3 w-3" />
            <span className={hasInlineAccessCode ? "font-mono tracking-wide" : ""}>{accessCodeValue}</span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          <Link
            href={editHref}
            className="inline-flex min-h-[28px] flex-1 items-center justify-center rounded-full bg-[var(--button-primary)] px-2 py-1 text-[10px] font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
          >
            编辑卡片
          </Link>
          <Link
            href={accessCodeHref}
            className="inline-flex min-h-[28px] flex-1 items-center justify-center rounded-full border border-[var(--outline)]/15 bg-white px-2 py-1 text-[10px] font-black text-[var(--foreground)]/74 shadow-sm transition hover:bg-[var(--surface-container)]"
          >
            管理提取码
          </Link>
        </div>
      </div>
    </article>
  );
}

export function FavoriteCard({
  item,
  onUnfavorited,
}: {
  item: FavoriteItem;
  onUnfavorited?: () => void;
}) {
  const cardHref = `/cards/${encodeURIComponent(item.card.id)}`;
  const isPaid = item.card.accessMode === "paid";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.1rem] border border-[var(--outline)]/20 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <Link href={cardHref} className="relative block aspect-[3/2] w-full overflow-hidden bg-[var(--surface-container)]">
        {isImageCard(item.card) ? (
          <ShareImage
            src={item.card.previewUrl}
            alt={item.card.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-end p-3">
            <p className="line-clamp-2 text-[10px] leading-4 text-[var(--foreground)]/66">
              {defaultCardDescription(item.card)}
            </p>
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2 py-0.5 text-[9px] font-black text-white/95 backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? "bg-[#f59e0b]" : "bg-[#2fbf71]"}`} />
          {isPaid ? "需提取码" : "免费"}
        </div>

        <span className="absolute right-2.5 top-2.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2 py-0.5 text-[9px] font-black text-white/95 backdrop-blur-sm">
          #{formatCardCode(item.card.id)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="min-w-0">
          <h2 className="line-clamp-1 text-sm font-black text-[var(--foreground)]">
            <Link href={cardHref}>{item.card.title}</Link>
          </h2>
          <p className="sr-only">{defaultCardDescription(item.card)}</p>
        </div>

        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-bold text-[var(--foreground)]/60">
          <span className="inline-flex items-center gap-1">
            <DownloadMiniIcon className="h-3 w-3" />
            {item.stats.downloadCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartMiniIcon className="h-3 w-3" />
            {item.stats.favoriteCount}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <FavoriteButton
            cardId={item.card.id}
            initialFavorited
            initialCount={item.stats.favoriteCount}
            className="!w-full !justify-center !rounded-full !border !border-[var(--outline)]/15 !bg-[var(--surface-container)] !px-3 !py-1.5 !text-[10px] !font-black !text-[var(--brand)] !shadow-sm hover:!bg-[var(--tertiary)]/60"
            onToggle={(nextFavorited) => {
              if (!nextFavorited) {
                onUnfavorited?.();
              }
            }}
          />
        </div>
      </div>
    </article>
  );
}

export function HistoryItem({ item }: { item: DashboardCard }) {
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const isDelisted = item.card.status === "delisted";

  return (
    <Link
      href={editHref}
      className="flex flex-col gap-3 rounded-[1rem] border border-[var(--outline)]/20 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-[var(--foreground)]">
            {item.card.title}
          </h3>
          <AccessModeBadge mode={item.card.accessMode} />
        </div>
        <p className="mt-1 text-[11px] font-bold text-[var(--foreground)]/62">
          最近更新于 {formatDate(item.card.updatedAt)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <StatusBadge>{getVisibilityLabel(item.card.visibility)}</StatusBadge>
          {isDelisted ? (
            <DelistedBadge>{getStatusLabel(item.card.status)}</DelistedBadge>
          ) : (
            <StatusBadge>{getStatusLabel(item.card.status)}</StatusBadge>
          )}
          <StatusBadge>{getReviewStatusLabel(item.card.reviewStatus)}</StatusBadge>
        </div>
        <ChevronRightIcon className="hidden h-4 w-4 text-[var(--foreground)]/30 sm:block" />
      </div>
    </Link>
  );
}

function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--surface-container-high)] px-1.5 py-0.5 text-[9px] font-black text-[var(--foreground)]/70">
      {children}
    </span>
  );
}

function DelistedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-[#f1c5cc] bg-[#fff5f7] px-1.5 py-0.5 text-[9px] font-black text-[#a31d3c]">
      {children}
    </span>
  );
}

function ChevronRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m9.47 5.47 1.06-1.06 6.28 6.28-6.28 6.28-1.06-1.06L14.13 12 9.47 7.34Z" fill="currentColor" />
    </svg>
  );
}

function DownloadMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 4.5h1.5v8.19l2.97-2.97 1.06 1.06L12 15.56l-4.78-4.78 1.06-1.06 2.97 2.97V4.5ZM5.25 17.25h13.5v1.5H5.25v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function CalendarMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M7.5 3.75h1.5v1.5h6v-1.5h1.5v1.5h1.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 20.25H6a2.25 2.25 0 0 1-2.25-2.25V7.5A2.25 2.25 0 0 1 6 5.25h1.5v-1.5ZM6 9.75v8.25c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75V9.75H6Z" fill="currentColor" />
    </svg>
  );
}

function KeyMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M13.5 6a4.5 4.5 0 1 0 3.96 6.64l4.79.01v1.5h-1.5v1.5h-1.5v1.5h-2.25V15.9h-1.33A4.5 4.5 0 0 0 13.5 6Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" fill="currentColor" />
    </svg>
  );
}

function HeartMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
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
