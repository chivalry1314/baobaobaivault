import Link from "next/link";

import { PaginationControls } from "@/components/share/pagination-controls/index";
import { ShareImage } from "@/components/share/share-image";
import {
  formatDateTime,
  getReviewStatusLabel,
} from "@/components/share/review-dashboard/helpers";
import type { ReviewFilter } from "@/components/share/review-dashboard/types";
import type { ReviewDashboardItem } from "@/lib/shared";

export function ReviewHeader() {
  return (
    <div className="border-b border-[var(--outline)]/20 pb-3">
      <h1 className="text-xl font-black text-[var(--foreground)]">审核中心</h1>
      <p className="mt-0.5 text-xs font-bold text-[var(--foreground)]/58">
        审批创作者提交的卡片，审核通过后才会在首页公开展示。
      </p>
    </div>
  );
}

export function ReviewFilterBar(props: {
  statusFilter: ReviewFilter;
  handleFilter: (nextFilter: ReviewFilter) => void;
}) {
  const { statusFilter, handleFilter } = props;
  const options: { value: ReviewFilter; label: string; activeClassName: string }[] = [
    { value: "", label: "全部待处理", activeClassName: "border-[var(--primary)] bg-[var(--primary)]/8 text-[var(--foreground)]" },
    { value: "pending", label: "待审核", activeClassName: "border-[#d67a33] bg-[#fff1df] text-[#8d4708]" },
    { value: "rejected", label: "已驳回", activeClassName: "border-[#cf425d] bg-[#fff5f7] text-[#a31d3c]" },
    { value: "approved", label: "已通过", activeClassName: "border-[#2d8d62] bg-[#e9fff2] text-[#11613f]" },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const active = statusFilter === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleFilter(option.value)}
            className={`rounded-full border-2 px-3 py-1.5 text-xs font-black transition ${
              active
                ? option.activeClassName
                : "border-[var(--outline)]/25 bg-white text-[var(--foreground)]/72 hover:border-[var(--outline)]/50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ReviewErrorNotice(props: { message: string }) {
  return (
    <p className="mt-3 rounded-xl border border-[#f3c8ad] bg-[#fff4ec] px-3 py-2 text-xs font-black text-[#9a3412]">
      {props.message}
    </p>
  );
}

export function ReviewLoadingGrid() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-64 animate-pulse rounded-[1.1rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]"
        />
      ))}
    </div>
  );
}

export function ReviewEmptyState() {
  return (
    <div className="mt-6 rounded-[1.2rem] border-2 border-dashed border-[var(--outline)]/30 bg-[var(--surface-container)] px-5 py-10 text-center text-xs font-black text-[var(--foreground)]/60">
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
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pagedItems.map((item) => {
          const status = item.card.reviewStatus;
          const disabled = Boolean(pendingCardId) && pendingCardId === item.card.id;
          const hideActions = status === "approved" || status === "rejected";
          return (
            <article key={item.card.id} className="group flex h-full flex-col overflow-hidden rounded-[1.1rem] border-2 border-[var(--outline)] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Link
                href={`/cards/${encodeURIComponent(item.card.id)}`}
                className="relative block aspect-[3/2] w-full overflow-hidden rounded-[0.8rem] bg-[var(--surface-container)]"
              >
                {item.card.mimeType.startsWith("image/") ? (
                  <ShareImage
                    src={item.card.previewUrl}
                    alt={item.card.title}
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm font-black text-[var(--foreground)]/72">
                    {item.card.title}
                  </div>
                )}
              </Link>

              <div className="mt-3 flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-sm font-black text-[var(--foreground)]">
                    {item.card.title}
                  </h2>
                  <ReviewStatusBadge status={status} />
                </div>

                <div className="mt-2 space-y-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
                  <p>作者：{item.creator.nickname || item.creator.username}</p>
                  <p>提交时间：{formatDateTime(item.submittedAt || item.card.submittedAt)}</p>
                </div>

                {item.card.reviewReason ? (
                  <p className="mt-2 truncate text-[10px] font-bold text-[#9a3412]">
                    驳回原因：{item.card.reviewReason}
                  </p>
                ) : null}

                {!hideActions ? (
                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleApprove(item.card.id)}
                      className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleReject(item.card.id)}
                      className="inline-flex items-center justify-center rounded-full border border-[#f1c5cc] bg-white px-3 py-1.5 text-xs font-black text-[#cf425d] shadow-sm transition hover:border-[#cf425d] hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      驳回
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto pt-3">
                    <span className="inline-flex w-full items-center justify-center rounded-full border border-[var(--outline)]/15 bg-[var(--surface-container)] px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/55">
                      已{status === "approved" ? "通过" : "驳回"}，无需操作
                    </span>
                  </div>
                )}
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

function ReviewStatusBadge({ status }: { status: ReviewDashboardItem["card"]["reviewStatus"] }) {
  const label = getReviewStatusLabel(status);
  const tone =
    status === "approved"
      ? "border-[#2d8d62] bg-[#e9fff2] text-[#11613f]"
      : status === "rejected"
        ? "border-[#cf425d] bg-[#fff5f7] text-[#a31d3c]"
        : "border-[#d67a33] bg-[#fff1df] text-[#8d4708]";

  return (
    <span className={`shrink-0 rounded-full border-2 px-2 py-0.5 text-[10px] font-black ${tone}`}>
      {label}
    </span>
  );
}
