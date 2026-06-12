"use client";

import Link from "next/link";

import { AccessModeFilterPills } from "@/components/share/access-mode-filter";
import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { useShareAccessCodeDashboard } from "@/components/share/access-code-dashboard/hooks";
import {
  AccessCodeCard,
  BackIcon,
  CardWithoutCodeRow,
  EmptyState,
  PlusIcon,
  SearchIcon,
} from "@/components/share/access-code-dashboard/sections";
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
    accessModeFilter,
    setAccessModeFilter,
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

  const footer = <UnifiedFooter />;

  if (loading && !dashboard && authenticated) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-[1460px] space-y-5">
            <div className="h-24 animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
            <div className="h-[520px] animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-[-9%] top-[8%] h-[22rem] w-[22rem] rounded-full bg-[rgba(207,243,250,0.35)] blur-[96px]" />
          <div className="absolute right-[-8%] bottom-[10%] h-[22rem] w-[22rem] rounded-full bg-[rgba(249,205,205,0.26)] blur-[96px]" />
        </div>

        <section className="relative z-10 mx-auto mt-6 flex w-full max-w-[1460px] flex-col px-5 pb-12 sm:px-8">
          <div className="mb-6 flex flex-col gap-4">
            <Link
              href="/creator"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--outline)]/15 bg-white/90 px-3.5 py-2 text-xs font-black text-[var(--foreground)] shadow-sm backdrop-blur-sm transition hover:bg-white hover:-translate-y-0.5"
            >
              <BackIcon className="h-4 w-4" />
              返回创作中心
            </Link>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">
                提取码管理
              </h1>
              <p className="mt-1.5 text-sm font-bold text-[var(--foreground)]/70">
                统一查看、复制、停用与恢复每张卡片的提取码。
              </p>
            </div>
          </div>

          {feedback ? (
            <div
              className={`mb-5 rounded-xl border px-4 py-3 text-xs font-bold ${
                feedback.type === "success"
                  ? "border-[#b8dec8] bg-[#f2fff5] text-[#166534]"
                  : "border-[#f3c8ad] bg-[#fff6ef] text-[#9a3412]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-5 shadow-sm md:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute left-[8%] top-[12%] h-32 w-32 rounded-full bg-[#cff3fa] opacity-40 blur-3xl" />
              <div className="absolute bottom-[10%] right-[9%] h-32 w-32 rounded-full bg-[#f9cdcd] opacity-30 blur-3xl" />
            </div>

            <div className="relative z-10">
              {!loadError && totalItems > 0 ? (
                <div className="mb-5 flex flex-col gap-3">
                  <label className="relative block w-full md:max-w-[420px]">
                    <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/40" />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="搜索标题、文件名或提取码..."
                      className="w-full rounded-full border-2 border-[var(--outline)]/20 bg-white py-2.5 pl-10 pr-4 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/20"
                    />
                  </label>

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <AccessModeFilterPills
                      value={accessModeFilter}
                      onChange={setAccessModeFilter}
                    />
                    <div className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-black text-[var(--foreground)]">
                      共 {totalItems} 条，第 {Math.min(itemsPage, itemsTotalPages)} /{" "}
                      {itemsTotalPages} 页
                    </div>
                  </div>
                </div>
              ) : null}

              {loadError ? (
                <div className="mb-2 flex flex-col gap-3 rounded-[1.2rem] border border-[#e59273] bg-[#fff6ef] px-4 py-3 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="w-fit rounded-full border border-[#f1b18a] bg-white px-3 py-1.5 text-xs font-black shadow-sm"
                  >
                    重新加载
                  </button>
                </div>
              ) : null}

              {cardsWithoutCode.length > 0 ? (
                <div className="mb-5 rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-black text-[var(--foreground)]">
                      <PlusIcon className="h-4 w-4 text-[var(--primary)]" />
                      未配置提取码的卡片
                    </div>
                    <div className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black text-[var(--foreground)]/76 shadow-sm">
                      共 {cardsWithoutCode.length} 条，第{" "}
                      {Math.min(cardsWithoutCodePage, cardsWithoutCodeTotalPages)} /{" "}
                      {cardsWithoutCodeTotalPages} 页
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {pagedCardsWithoutCode.map((card) => (
                        <CardWithoutCodeRow
                          key={card.id}
                          card={card}
                          onConfigureAccessCode={handleConfigureAccessCode}
                        />
                      ))}
                    </div>
                    <PaginationControls
                      page={cardsWithoutCodePage}
                      totalPages={cardsWithoutCodeTotalPages}
                      onPageChange={(nextPage) =>
                        setCardsWithoutCodePage(
                          Math.min(
                            Math.max(nextPage, 1),
                            cardsWithoutCodeTotalPages,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {!loadError && totalItems === 0 ? (
                <EmptyState
                  cardsWithoutCode={cardsWithoutCode}
                  onConfigureAccessCode={handleConfigureAccessCode}
                  onCreateCard={handleCreateCard}
                />
              ) : null}

              {!loadError && totalItems > 0 && items.length === 0 ? (
                <div className="rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] px-5 py-10 text-center">
                  <h2 className="text-lg font-black text-[var(--foreground)]">
                    没有匹配到提取码
                  </h2>
                  <p className="mt-2 text-xs font-bold text-[var(--foreground)]/62">
                    试试更短的关键词、切换免费/需提取码筛选，或清空搜索后查看全部提取码。
                  </p>
                </div>
              ) : null}

              {items.length > 0 ? (
                <div className="space-y-4">
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
                  <PaginationControls
                    page={itemsPage}
                    totalPages={itemsTotalPages}
                    onPageChange={(nextPage) =>
                      setItemsPage(
                        Math.min(Math.max(nextPage, 1), itemsTotalPages),
                      )
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
