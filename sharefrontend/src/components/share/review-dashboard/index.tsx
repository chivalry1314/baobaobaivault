"use client";

import Link from "next/link";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { useShareReviewDashboard } from "@/components/share/review-dashboard/hooks";
import {
  ReviewEmptyState,
  ReviewErrorNotice,
  ReviewFilterBar,
  ReviewGrid,
  ReviewHeader,
  ReviewLoadingGrid,
} from "@/components/share/review-dashboard/sections";

export function ShareReviewDashboard() {
  const {
    sessionChecking,
    currentUser,
    loading,
    items,
    loadError,
    actionError,
    statusFilter,
    pendingCardId,
    page,
    setPage,
    totalPages,
    pagedItems,
    handleApprove,
    handleReject,
    handleFilter,
  } = useShareReviewDashboard();

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="dream-panel mx-auto max-w-7xl px-6 py-14 text-center text-[var(--foreground)]/72">
          正在加载审核中心...
        </div>
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
            <p className="text-lg font-black text-[#9a3412]">
              当前账号不是管理员，无法进入审核中心。
            </p>
            <Link
              href="/creator"
              className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-black"
            >
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
          <ReviewHeader />
          <ReviewFilterBar statusFilter={statusFilter} handleFilter={handleFilter} />

          {loadError ? <ReviewErrorNotice message={loadError} /> : null}
          {actionError ? <ReviewErrorNotice message={actionError} /> : null}

          {loading ? <ReviewLoadingGrid /> : null}
          {!loading && items.length === 0 ? <ReviewEmptyState /> : null}
          {!loading && items.length > 0 ? (
            <ReviewGrid
              pagedItems={pagedItems}
              pendingCardId={pendingCardId}
              handleApprove={handleApprove}
              handleReject={handleReject}
              page={page}
              totalPages={totalPages}
              setPage={setPage}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}


