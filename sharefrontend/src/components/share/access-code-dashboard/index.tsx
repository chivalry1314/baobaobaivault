"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { useShareAccessCodeDashboard } from "@/components/share/access-code-dashboard/hooks";
import { AccessCodeCard, BackIcon, CardWithoutCodeRow, EmptyState, PlusIcon, SearchIcon, SparkleIcon } from "@/components/share/access-code-dashboard/sections";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { UnifiedFooter } from "@/components/share/unified-footer/index";

export function ShareAccessCodeDashboard() {
  const {
    loading,
    authenticated,
    dashboard,
    loadError,
    feedback,
    searchValue,
    setSearchValue,
    pendingAction,
    itemsPage,
    setItemsPage,
    cardsWithoutCodePage,
    setCardsWithoutCodePage,
    items,
    cardsWithoutCode,
    cardsWithoutCodeTotalPages,
    pagedCardsWithoutCode,
    totalItems,
    itemsTotalPages,
    pagedItems,
    loadDashboard,
    handleCopyLink,
    handleHide,
    handleReactivate,
    handleDelete,
    handleCreateCard,
    handleConfigureAccessCode,
  } = useShareAccessCodeDashboard();

  const footer = useMemo(() => <UnifiedFooter />, []);

  if (loading && !dashboard && authenticated) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-[1460px] space-y-6">
            <div className="h-28 animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
            <div className="h-[520px] animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return <AuthRedirect nextPath="/creator/access-codes" />;
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-9%] top-[8%] h-[22rem] w-[22rem] rounded-full bg-[rgba(207,243,250,0.5)] blur-[96px]" />
          <div className="absolute right-[-8%] bottom-[10%] h-[22rem] w-[22rem] rounded-full bg-[rgba(249,205,205,0.36)] blur-[96px]" />
        </div>

        <section className="relative z-10 mx-auto mt-8 flex w-full max-w-[1460px] flex-col px-5 pb-12 sm:px-8">
          <div className="mb-8 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <Link
                href="/creator"
                className="inline-flex w-fit items-center gap-2 rounded-full border-[3px] border-[var(--line-strong)] bg-white px-6 py-2.5 text-[var(--foreground)] shadow-[2px_2px_0px_var(--line-strong)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                <BackIcon className="h-5 w-5" />
                <span className="font-black">返回</span>
                <SparkleIcon className="h-5 w-5 text-[var(--brand)]" />
              </Link>

              <div>
                <h1 className="text-4xl font-black tracking-tight text-[var(--foreground)] md:text-5xl">提取码管理</h1>
                <p className="mt-3 text-lg font-bold text-[var(--foreground)]/70">统一查看、复制、停用与恢复每张卡片的提取码。</p>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`mb-6 rounded-[20px] border px-5 py-4 text-sm font-bold ${
                feedback.type === "success" ? "border-[#b8dec8] bg-[#f2fff5] text-[#166534]" : "border-[#f3c8ad] bg-[#fff6ef] text-[#9a3412]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-3xl border-[4px] border-[var(--line-strong)] bg-white p-6 shadow-[6px_6px_0px_var(--line-strong)] md:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full bg-[#cff3fa] opacity-45 blur-3xl" />
              <div className="absolute bottom-[10%] right-[9%] h-40 w-40 rounded-full bg-[#f9cdcd] opacity-35 blur-3xl" />
            </div>

            <div className="relative z-10">
              {!loadError && totalItems > 0 ? (
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <label className="relative block w-full md:max-w-[520px]">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--foreground)]/40" />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="搜索标题、文件名或提取码..."
                      className="dream-input w-full py-3 pl-12 pr-4 font-bold"
                    />
                  </label>

                  <div className="rounded-full border-[3px] border-[var(--line-strong)] bg-[#fcf1a7] px-4 py-2 text-sm font-black text-[var(--foreground)]">
                    共 {totalItems} 条，当前第 {Math.min(itemsPage, itemsTotalPages)} / {itemsTotalPages} 页，显示 {pagedItems.length} 条
                  </div>
                </div>
              ) : null}

              {loadError ? (
                <div className="mb-2 flex flex-col gap-3 rounded-[22px] border border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="rounded-full border border-[#f1b18a] px-4 py-2 text-sm font-bold transition hover:bg-white/80"
                  >
                    重新加载
                  </button>
                </div>
              ) : null}

              {cardsWithoutCode.length > 0 ? (
                <div className="mb-6 rounded-[24px] border-[3px] border-[var(--line-strong)] bg-[#f8fcff] p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-base font-black text-[var(--foreground)]">
                      <PlusIcon className="h-5 w-5 text-[var(--primary)]" />
                      未配置提取码的卡片
                    </div>
                    <div className="rounded-full border-[2px] border-[var(--line-strong)] bg-white px-3 py-1 text-xs font-black text-[var(--foreground)]/76">
                      共 {cardsWithoutCode.length} 条，当前第 {Math.min(cardsWithoutCodePage, cardsWithoutCodeTotalPages)} / {cardsWithoutCodeTotalPages} 页
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {pagedCardsWithoutCode.map((card) => (
                        <CardWithoutCodeRow key={card.id} card={card} onConfigureAccessCode={handleConfigureAccessCode} />
                      ))}
                    </div>
                    <PaginationControls
                      page={cardsWithoutCodePage}
                      totalPages={cardsWithoutCodeTotalPages}
                      onPageChange={(nextPage) => setCardsWithoutCodePage(Math.min(Math.max(nextPage, 1), cardsWithoutCodeTotalPages))}
                    />
                  </div>
                </div>
              ) : null}

              {!loadError && totalItems === 0 ? (
                <EmptyState cardsWithoutCode={cardsWithoutCode} onConfigureAccessCode={handleConfigureAccessCode} onCreateCard={handleCreateCard} />
              ) : null}

              {!loadError && totalItems > 0 && items.length === 0 ? (
                <div className="rounded-[24px] border-[3px] border-[var(--line-strong)] bg-[#f8fcff] px-6 py-12 text-center">
                  <h2 className="text-2xl font-black text-[var(--foreground)]">没有匹配到提取码</h2>
                  <p className="mt-3 text-sm font-bold text-[var(--foreground)]/62">试试更短的关键词，或清空搜索后查看全部提取码。</p>
                </div>
              ) : null}

              {items.length > 0 ? (
                <div className="space-y-5">
                  <div className="grid w-full items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {pagedItems.map((item) => (
                      <AccessCodeCard
                        key={item.card.id}
                        item={item}
                        pendingAction={pendingAction}
                        onEdit={() => handleConfigureAccessCode(item.card.id)}
                        onCopy={() => void handleCopyLink(item)}
                        onHide={() => void handleHide(item)}
                        onReactivate={() => void handleReactivate(item)}
                        onDelete={() => void handleDelete(item)}
                      />
                    ))}
                  </div>
                  <PaginationControls page={itemsPage} totalPages={itemsTotalPages} onPageChange={(nextPage) => setItemsPage(Math.min(Math.max(nextPage, 1), itemsTotalPages))} />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}



