"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { PaginationControls } from "@/components/share/pagination-controls";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser, ReviewDashboardItem, ShareReviewStatus } from "@/lib/shared";

const PAGE_SIZE = 9;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getReviewStatusLabel(status: ShareReviewStatus) {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "未提交";
  }
}

export function ShareReviewDashboard() {
  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReviewDashboardItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ShareReviewStatus>("");
  const [pendingCardId, setPendingCardId] = useState("");
  const [page, setPage] = useState(1);

  async function loadReviews(nextFilter: "" | ShareReviewStatus) {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await shareApi.adminReviews(nextFilter || undefined);
      setItems(payload.items);
      setPage(1);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载审核列表失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }
        if (!session.authenticated || !session.user) {
          setCurrentUser(null);
          return;
        }
        setCurrentUser(session.user);
        if (session.user.role !== "manager") {
          return;
        }
        await loadReviews(statusFilter);
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length]);
  const pagedItems = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page, totalPages]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  async function handleApprove(cardId: string) {
    setPendingCardId(cardId);
    setActionError("");
    try {
      await shareApi.adminApproveReview(cardId);
      await loadReviews(statusFilter);
    } catch (error) {
      setActionError(getShareErrorMessage(error, "审核通过失败，请稍后重试。"));
    } finally {
      setPendingCardId("");
    }
  }

  async function handleReject(cardId: string) {
    const reason = window.prompt("请输入驳回原因（必填）：", "");
    if (reason === null) {
      return;
    }
    if (!reason.trim()) {
      setActionError("驳回原因不能为空。");
      return;
    }
    setPendingCardId(cardId);
    setActionError("");
    try {
      await shareApi.adminRejectReview(cardId, reason.trim());
      await loadReviews(statusFilter);
    } catch (error) {
      setActionError(getShareErrorMessage(error, "驳回失败，请稍后重试。"));
    } finally {
      setPendingCardId("");
    }
  }

  async function handleFilter(nextFilter: "" | ShareReviewStatus) {
    setStatusFilter(nextFilter);
    await loadReviews(nextFilter);
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="dream-panel mx-auto max-w-7xl px-6 py-14 text-center text-[var(--foreground)]/72">正在加载审核中心...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath="/creator/reviews" />;
  }

  if (currentUser.role !== "manager") {
    return (
      <AppShell currentPath="/creator/reviews">
        <div className="min-h-screen px-4 py-10 sm:px-6">
          <div className="dream-panel mx-auto max-w-3xl px-6 py-12 text-center">
            <p className="text-lg font-black text-[#9a3412]">当前账号不是管理员，无法进入审核中心。</p>
            <Link href="/creator" className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-black">
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/creator/reviews">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6">
        <div className="dream-panel px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
            <div>
              <h1 className="text-2xl font-black text-[var(--foreground)]">审核中心</h1>
              <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">审批创作者提交的卡片，审批通过后才会在首页公开展示。</p>
            </div>
            <Link href="/creator" className="btn-subtle rounded-full px-4 py-2 text-sm font-black">
              返回创作中心
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void handleFilter("")} className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "" ? "btn-primary" : "btn-subtle"}`}>
              全部待处理
            </button>
            <button type="button" onClick={() => void handleFilter("pending")} className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "pending" ? "btn-primary" : "btn-subtle"}`}>
              待审核
            </button>
            <button type="button" onClick={() => void handleFilter("rejected")} className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "rejected" ? "btn-primary" : "btn-subtle"}`}>
              已驳回
            </button>
            <button type="button" onClick={() => void handleFilter("approved")} className={`rounded-full px-4 py-2 text-xs font-black ${statusFilter === "approved" ? "btn-primary" : "btn-subtle"}`}>
              已通过
            </button>
          </div>

          {loadError ? <p className="mt-4 rounded-xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{loadError}</p> : null}
          {actionError ? <p className="mt-4 rounded-xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{actionError}</p> : null}

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/80 bg-white/70" />
              ))}
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="mt-8 rounded-2xl border-[2px] border-dashed border-[var(--line-strong)]/30 bg-white/75 px-6 py-12 text-center text-sm font-bold text-[var(--text-muted)]">当前筛选下暂无审核数据。</div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {pagedItems.map((item) => {
                  const status = item.card.reviewStatus;
                  const disabled = Boolean(pendingCardId) && pendingCardId === item.card.id;
                  return (
                    <article key={item.card.id} className="dream-panel p-4">
                      <Link href={`/cards/${encodeURIComponent(item.card.id)}`} className="block overflow-hidden rounded-2xl bg-[#f8f9fa]">
                        {item.card.mimeType.startsWith("image/") ? (
                          <img src={item.card.previewUrl} alt={item.card.title} className="h-44 w-full object-cover" />
                        ) : (
                          <div className="flex h-44 items-center justify-center px-4 text-center text-sm font-black text-[var(--foreground)]">{item.card.title}</div>
                        )}
                      </Link>
                      <div className="mt-4">
                        <h2 className="truncate text-lg font-black text-[var(--foreground)]">{item.card.title}</h2>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">作者：{item.creator.nickname || item.creator.username}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">提交时间：{formatDateTime(item.submittedAt || item.card.submittedAt)}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">审核状态：{getReviewStatusLabel(status)}</p>
                        {item.card.reviewReason ? <p className="mt-1 text-xs text-[#9a3412]">驳回原因：{item.card.reviewReason}</p> : null}
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
              <PaginationControls page={page} totalPages={totalPages} onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))} />
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
