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
          <div className="mx-auto max-w-3xl rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-base font-black text-[#9a3412]">
              当前账号不是管理员，无法进入审核中心。
            </p>
            <Link
              href="/creator"
              className="mt-5 inline-flex rounded-full bg-[var(--button-primary)] px-5 py-2 text-sm font-black shadow-sm transition hover:bg-[var(--button-primary-hover)]"
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
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-6%] top-[10%] h-[16rem] w-[16rem] rounded-full bg-[rgba(176,232,249,0.34)] blur-[100px]" />
          <div className="absolute right-[-4%] top-[18%] h-[14rem] w-[14rem] rounded-full bg-[rgba(248,219,230,0.28)] blur-[100px]" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[var(--layout-max)] px-4 pb-16 pt-8 sm:px-6">
          <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
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
        </section>
      </div>
    </AppShell>
  );
}


