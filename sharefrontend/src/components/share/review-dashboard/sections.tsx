import Link from "next/link";

import { PaginationControls } from "@/components/share/pagination-controls/index";
import {
  formatDateTime,
  getReviewStatusLabel,
} from "@/components/share/review-dashboard/helpers";
import type { ReviewFilter } from "@/components/share/review-dashboard/types";
import type { ReviewDashboardItem } from "@/lib/shared";

export function ReviewHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
      <div>
        <h1 className="text-2xl font-black text-[var(--foreground)]">审核中心</h1>
        <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
          审批创作者提交的卡片，审核通过后才会在首页公开展示。
        </p>
      </div>
      <Link href="/creator" className="btn-subtle rounded-full px-4 py-2 text-sm font-black">
        返回创作中心
      </Link>
    </div>
  );
}

export function ReviewFilterBar(props: {
  statusFilter: ReviewFilter;
  handleFilter: (nextFilter: ReviewFilter) => void;
}) {
  const { statusFilter, handleFilter } = props;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => handleFilter("")}
        className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "" ? "btn-primary" : "btn-subtle"}`}
      >
        全部待处理
      </button>
      <button
        type="button"
        onClick={() => handleFilter("pending")}
        className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "pending" ? "btn-primary" : "btn-subtle"}`}
      >
        待审核
      </button>
      <button
        type="button"
        onClick={() => handleFilter("rejected")}
        className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "rejected" ? "btn-primary" : "btn-subtle"}`}
      >
        已驳回
      </button>
      <button
        type="button"
        onClick={() => handleFilter("approved")}
        className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "approved" ? "btn-primary" : "btn-subtle"}`}
      >
        已通过
      </button>
    </div>
  );
}

export function ReviewErrorNotice(props: { message: string }) {
  return (
    <p className="mt-4 rounded-xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">
      {props.message}
    </p>
  );
}

export function ReviewLoadingGrid() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-56 animate-pulse rounded-2xl border border-white/80 bg-white/70"
        />
      ))}
    </div>
  );
}

export function ReviewEmptyState() {
  return (
    <div className="mt-8 rounded-2xl border-[2px] border-dashed border-[var(--line-strong)]/30 bg-white/75 px-6 py-12 text-center text-sm font-bold text-[var(--text-muted)]">
      当前筛选下暂无审核数据。
    </div>
  );
}

export function ReviewGrid(props: {
  pagedItems: ReviewDashboardItem[];
  pendingCardId: string;
  handleApprove: (cardId: string) => Promise<void>;
  handleReject: (cardId: string) => Promise<void>;
  page: number;
  totalPages: number;
  setPage: (next: number) => void;
}) {
  const {
    pagedItems,
    pendingCardId,
    handleApprove,
    handleReject,
    page,
    totalPages,
    setPage,
  } = props;

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {pagedItems.map((item) => {
          const status = item.card.reviewStatus;
          const disabled = Boolean(pendingCardId) && pendingCardId === item.card.id;
          return (
            <article key={item.card.id} className="dream-panel p-4">
              <Link
                href={`/cards/${encodeURIComponent(item.card.id)}`}
                className="block overflow-hidden rounded-2xl bg-[#f8f9fa]"
              >
                {item.card.mimeType.startsWith("image/") ? (
                  <img
                    src={item.card.previewUrl}
                    alt={item.card.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center px-4 text-center text-sm font-black text-[var(--foreground)]">
                    {item.card.title}
                  </div>
                )}
              </Link>
              <div className="mt-4">
                <h2 className="truncate text-lg font-black text-[var(--foreground)]">
                  {item.card.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  作者：{item.creator.nickname || item.creator.username}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  提交时间：{formatDateTime(item.submittedAt || item.card.submittedAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  审核状态：{getReviewStatusLabel(status)}
                </p>
                {item.card.reviewReason ? (
                  <p className="mt-1 text-xs text-[#9a3412]">
                    驳回原因：{item.card.reviewReason}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || status === "approved"}
                  onClick={() => void handleApprove(item.card.id)}
                  className="btn-primary flex-1 rounded-full py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  通过
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void handleReject(item.card.id)}
                  className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-4 py-2 text-xs font-black text-[#ff6b6b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  驳回
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) =>
          setPage(Math.min(Math.max(nextPage, 1), totalPages))
        }
      />
    </div>
  );
}
