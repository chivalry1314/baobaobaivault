import Link from "next/link";
import type { ReactNode } from "react";

import { AccessModeBadge } from "@/components/share/access-mode-badge";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import { ShareImage } from "@/components/share/share-image";
import {
  formatDate,
  formatDateTime,
  getInactiveReason,
  isActiveItem,
} from "@/components/share/access-code-dashboard/helpers";
import type { AccessCodeDashboardItem, PlatformCard } from "@/lib/shared";

export function EmptyState(props: {
  cardsWithoutCode: PlatformCard[];
  onConfigureAccessCode: (cardId: string) => void;
  onCreateCard: () => void;
}) {
  const { cardsWithoutCode, onConfigureAccessCode, onCreateCard } = props;
  const hasAvailableCard = cardsWithoutCode.length > 0;

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[1.4rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] px-5 py-10 text-center">
      <div className="absolute left-[18%] top-[22%] h-28 w-28 rounded-full bg-[#cff3fa] opacity-50 blur-3xl" />
      <div className="absolute bottom-[18%] right-[18%] h-28 w-28 rounded-full bg-[#f9cdcd] opacity-40 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--outline)] bg-[var(--secondary)] shadow-sm">
          <KeyIcon className="h-6 w-6 text-[var(--foreground)]" />
        </div>

        <h2 className="text-xl font-black text-[var(--foreground)]">还没有提取码</h2>
        <p className="mt-2 max-w-xl text-xs font-bold text-[var(--foreground)]/70">
          {hasAvailableCard ? "你已有可用卡片，直接点击下面按钮即可进入对应卡片的提取码配置页。" : "你还没有可配置提取码的卡片，先去创建并发布一张卡片吧。"}
        </p>

        {hasAvailableCard ? (
          <div className="mt-6 flex w-full max-w-2xl flex-col gap-2.5">
            {cardsWithoutCode.map((card) => (
              <CardWithoutCodeRow key={card.id} card={card} onConfigureAccessCode={onConfigureAccessCode} />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreateCard}
            className="mt-6 rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-6 py-2 text-sm font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
          >
            去创建卡片
          </button>
        )}
      </div>
    </div>
  );
}

export function CardWithoutCodeRow(props: {
  card: PlatformCard;
  onConfigureAccessCode: (cardId: string) => void;
}) {
  const { card, onConfigureAccessCode } = props;

  return (
    <div className="flex items-center gap-2 rounded-[0.85rem] border border-[var(--outline)]/15 bg-white px-3 py-2 text-left shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-black text-[var(--foreground)]">{card.title}</p>
          <span className="shrink-0">
            <AccessModeBadge mode={card.accessMode} compact />
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] font-bold text-[var(--foreground)]/56">{card.originalFileName || "未命名文件"}</p>
      </div>
      <ActionButton onClick={() => onConfigureAccessCode(card.id)}>
        <EditIcon className="h-3.5 w-3.5" />
        配置
      </ActionButton>
    </div>
  );
}

export function AccessCodeCard(props: {
  item: AccessCodeDashboardItem;
  pendingAction: string;
  onEdit: () => void;
  onCopy: () => void;
  onHide: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const { item, pendingAction, onEdit, onCopy, onHide, onReactivate, onDelete } = props;
  const active = isActiveItem(item);
  const statusTip = active ? "提取码可正常使用，访问链接可直接分发给用户。" : getInactiveReason(item);
  const codeTone = active
    ? "border-[var(--outline)]/15 bg-[var(--tertiary)]/40 text-[var(--foreground)]"
    : "border-[var(--outline)]/12 bg-[var(--surface-container)] text-[var(--foreground)]/42";

  return (
    <article className="flex flex-col overflow-hidden rounded-[1rem] border-2 border-[var(--outline)] bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* top: image + main info */}
      <div className="flex gap-2.5">
        <Link
          href={`/cards/${encodeURIComponent(item.card.id)}`}
          className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[0.7rem] border border-[var(--outline)]/15 bg-[#4f4a75] sm:h-[80px] sm:w-[80px]"
        >
          {item.card.mimeType.startsWith("image/") ? (
            <ShareImage src={item.card.previewUrl} alt={item.card.title} fill sizes="(max-width: 640px) 72px, 80px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-medium text-white/92">{item.card.title}</div>
          )}

        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black leading-tight text-[var(--foreground)]">
                <Link href={`/cards/${encodeURIComponent(item.card.id)}`}>{item.card.title}</Link>
              </h2>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/48">创建于 {formatDate(item.card.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
            >
              <EditIcon className="h-3 w-3" />
              配置提取码
            </button>
          </div>

          <div className="mt-1">
            <AccessModeBadge mode={item.card.accessMode} compact />
          </div>

          <div className={`mt-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-black tracking-[0.04em] ${codeTone}`}>
            {active ? <KeyIcon className="h-3 w-3 shrink-0" /> : <LockIcon className="h-3 w-3 shrink-0" />}
            <span className={`truncate ${active ? "" : "line-through"}`}>{item.config.code}</span>
          </div>
        </div>
      </div>

      {/* meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold text-[var(--foreground)]/60">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          到期 {formatDateTime(item.config.expiresAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <DownloadMiniIcon className="h-3 w-3 text-[var(--brand)]/70" />
          已用 {item.config.usageCount}
          {item.config.unlimited ? " / 不限" : ` / ${Math.max(item.config.usageLimit, 0)}`}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
            active ? "bg-[var(--secondary)]/70 text-[var(--foreground)]" : "bg-[var(--surface-container-high)] text-[var(--foreground)]/60"
          }`}
        >
          {active ? "启用中" : "已停用"}
        </span>
      </div>

      {/* status tip */}
      <p className="mt-1 text-[10px] font-bold leading-4 text-[var(--foreground)]/52">{statusTip}</p>

      {/* actions */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {active ? (
          <>
            <ActionButton disabled={pendingAction === `copy:${item.card.id}`} onClick={onCopy}>
              {pendingAction === `copy:${item.card.id}` ? (
                <LoadingSpinner size="sm" inline />
              ) : (
                <>
                  <LinkIcon className="h-3.5 w-3.5" />
                  复制链接
                </>
              )}
            </ActionButton>
            <ActionButton danger disabled={pendingAction === `hide:${item.card.id}`} onClick={onHide}>
              {pendingAction === `hide:${item.card.id}` ? (
                <LoadingSpinner size="sm" inline />
              ) : (
                <>
                  <HideIcon className="h-3.5 w-3.5" />
                  停用
                </>
              )}
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton disabled={pendingAction === `reactivate:${item.card.id}`} onClick={onReactivate}>
              {pendingAction === `reactivate:${item.card.id}` ? (
                <LoadingSpinner size="sm" inline />
              ) : (
                <>
                  <RefreshIcon className="h-3.5 w-3.5" />
                  重新启用
                </>
              )}
            </ActionButton>
            <IconActionButton danger disabled={pendingAction === `delete:${item.card.id}`} onClick={onDelete}>
              {pendingAction === `delete:${item.card.id}` ? <LoadingSpinner size="sm" inline /> : <TrashIcon className="h-3.5 w-3.5" />}
            </IconActionButton>
          </>
        )}
      </div>
    </article>
  );
}

export function ActionButton(props: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { children, onClick, disabled = false, danger = false } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-[#f1c5cc] bg-white text-[#cf425d] hover:border-[#cf425d] hover:bg-[#fff7f8]"
          : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78 hover:bg-[var(--surface-container)]"
      }`}
    >
      {children}
    </button>
  );
}

export function IconActionButton(props: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { children, onClick, disabled = false, danger = false } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger ? "border-[#ead2d8] bg-white text-[#b18a92] hover:border-[#cf425d] hover:text-[#cf425d]" : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78 hover:bg-[var(--surface-container)]"
      }`}
    >
      {children}
    </button>
  );
}

export function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-1.5a7.5 7.5 0 1 1-4.72 13.33l-3.3 3.29-1.06-1.06 3.29-3.3A7.5 7.5 0 0 1 10.5 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}

export function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 2 1.56 4.44L18 8l-4.44 1.56L12 14l-1.56-4.44L6 8l4.44-1.56L12 2Zm-6 12 1.04 2.96L10 18l-2.96 1.04L6 22l-1.04-2.96L2 18l2.96-1.04L6 14Zm12 1 1.04 2.96L22 19l-2.96 1.04L18 23l-1.04-2.96L14 19l2.96-1.04L18 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 4.5h1.5v6.75h6.75v1.5h-6.75v6.75h-1.5v-6.75H4.5v-1.5h6.75V4.5Z" fill="currentColor" />
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

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75A4.5 4.5 0 0 0 7.5 8.25V10.5h-.75A2.25 2.25 0 0 0 4.5 12.75v6A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-6a2.25 2.25 0 0 0-2.25-2.25h-.75V8.25A4.5 4.5 0 0 0 12 3.75Zm-3 6.75V8.25a3 3 0 1 1 6 0v2.25H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m16.94 4.94 2.12 2.12-9.3 9.3-3.18 1.06 1.06-3.18 9.3-9.3Zm1.06-1.06a1.5 1.5 0 0 1 2.12 0l.94.94a1.5 1.5 0 0 1 0 2.12l-1 1-3.18-3.18 1-1Z" fill="currentColor" />
    </svg>
  );
}

function LinkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M10.72 13.28a3.75 3.75 0 0 0 5.3 0l2.47-2.47a3.75 3.75 0 1 0-5.3-5.3l-.93.93 1.06 1.06.93-.93a2.25 2.25 0 1 1 3.18 3.18l-2.47 2.47a2.25 2.25 0 0 1-3.18 0l-.53-.53-1.06 1.06.53.53Zm2.56-2.56a3.75 3.75 0 0 0-5.3 0l-2.47 2.47a3.75 3.75 0 0 0 5.3 5.3l.93-.93-1.06-1.06-.93.93a2.25 2.25 0 1 1-3.18-3.18l2.47-2.47a2.25 2.25 0 0 1 3.18 0l.53.53 1.06-1.06-.53-.53Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HideIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 5.25c4.43 0 8.2 2.72 9.75 6.75a10.67 10.67 0 0 1-2.42 3.75l1.48 1.48-1.06 1.06-16-16 1.06-1.06 3.01 3a10.4 10.4 0 0 1 4.18-.88Zm0 1.5c-.99 0-1.94.17-2.82.49l1.35 1.35A3.75 3.75 0 0 1 15.4 13.47l2.83 2.83A9.05 9.05 0 0 0 20.15 12C18.76 8.85 15.68 6.75 12 6.75ZM7.53 8.59 5.77 6.83A8.94 8.94 0 0 0 3.85 12C5.24 15.15 8.32 17.25 12 17.25c1.18 0 2.3-.22 3.34-.63l-1.92-1.92a3.75 3.75 0 0 1-4.83-4.83L7.53 8.59Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RefreshIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 4.5a7.5 7.5 0 0 1 6.84 4.42V6.75h1.5v5.25h-5.25V10.5h2.64A6 6 0 1 0 18 15h1.53A7.5 7.5 0 1 1 12 4.5Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M9 3.75h6l.75 1.5H19.5v1.5h-15v-1.5h3.75L9 3.75Zm-1.5 6h1.5v7.5H7.5v-7.5Zm4.5 0h1.5v7.5H12v-7.5Zm4.5 0H18v7.5h-1.5v-7.5Z" fill="currentColor" />
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

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 3.75h1.5v1.5h6v-1.5h1.5v1.5h1.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 20.25H6a2.25 2.25 0 0 1-2.25-2.25V7.5A2.25 2.25 0 0 1 6 5.25h1.5v-1.5ZM6 9.75v8.25c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75V9.75H6Z"
        fill="currentColor"
      />
    </svg>
  );
}
