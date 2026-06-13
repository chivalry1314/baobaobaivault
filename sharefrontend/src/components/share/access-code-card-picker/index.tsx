"use client";

import Link from "next/link";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { filterOptions } from "@/components/share/access-code-card-picker/helpers";
import { useShareAccessCodeCardPicker } from "@/components/share/access-code-card-picker/hooks";
import { AccessCodePickerIcons, CardPickerGridItem, CardPickerListItem, EmptyCard, StepPill } from "@/components/share/access-code-card-picker/sections";
import { UnifiedFooter } from "@/components/share/unified-footer/index";

const { ArrowRightIcon, BackIcon, FilterIcon, GridIcon, HeartIcon, ListIcon, SettingsIcon, SparkleIcon } = AccessCodePickerIcons;

export function ShareAccessCodeCardPicker() {
  const {
    loading,
    authenticated,
    cards,
    setSelectedCardId,
    viewMode,
    setViewMode,
    visibilityFilter,
    setVisibilityFilter,
    filterOpen,
    setFilterOpen,
    loadError,
    filteredCards,
    effectiveSelectedCardId,
    selectedCard,
    handleNext,
  } = useShareAccessCodeCardPicker();

  if (loading && authenticated) {
    return (
      <AppShell currentPath="/creator" footerSlot={<UnifiedFooter />}>
        <div className="px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-[1480px] space-y-6">
            <div className="dream-panel h-28 animate-pulse" />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="dream-panel h-[420px] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return <AuthRedirect nextPath="/creator/access-codes/new" />;
  }

  return (
    <AppShell currentPath="/creator" footerSlot={<UnifiedFooter />}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_52%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[8%] h-[26rem] w-[26rem] rounded-full bg-[rgba(176,232,249,0.36)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-[rgba(203,234,249,0.3)] blur-[120px]" />
          <div className="absolute bottom-[-16%] left-[22%] h-[28rem] w-[28rem] rounded-full bg-[rgba(248,219,230,0.24)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1520px] px-4 pb-20 pt-10 sm:px-6">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link href="/creator/access-codes" className="btn-subtle inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-[var(--foreground)]/72 transition hover:-translate-y-0.5">
                <BackIcon className="h-4.5 w-4.5" />
                <span>返回管理</span>
              </Link>

              <div className="dream-chip mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-black text-[var(--primary)]">
                <SparkleIcon className="h-4.5 w-4.5" />
                <span>创建提取码流程</span>
              </div>

              <h1 className="mt-6 text-5xl font-black tracking-tight text-[var(--foreground)] sm:text-[3.8rem]">选择目标卡片</h1>
              <p className="mt-4 max-w-3xl text-xl leading-9 text-[var(--foreground)]/66">
                先选一张要分享的卡片，再进入下一步配置提取码规则。你可以在这里按公开性筛选卡片，并切换网格或列表查看方式。
              </p>
            </div>

            <div className="dream-panel-soft flex flex-wrap items-center gap-4 px-5 py-4">
              <StepPill active label="STEP 01" title="选择目标卡片" icon={<HeartIcon className="h-5 w-5" />} />
              <div className="dream-divider hidden h-px w-12 border-t lg:block" />
              <StepPill active={false} label="STEP 02" title="配置提取码规则" icon={<SettingsIcon className="h-5 w-5" />} />
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm tracking-[0.08em] text-[var(--foreground)]/46">
              {cards.length > 0 ? `当前共有 ${cards.length} 张可用于生成提取码的卡片` : "还没有可用于生成提取码的卡片，先创建一张卡片吧"}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button type="button" onClick={() => setFilterOpen((current) => !current)} className="dream-chip inline-flex items-center gap-2 px-5 py-3 text-base font-black text-[var(--foreground)] transition hover:-translate-y-0.5">
                  <FilterIcon className="h-5 w-5" />
                  <span>筛选</span>
                </button>

                {filterOpen ? (
                  <div className="dream-panel-soft absolute right-0 top-[calc(100%+0.75rem)] z-20 w-80 p-3">
                    {filterOptions.map((option) => {
                      const active = option.value === visibilityFilter;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setVisibilityFilter(option.value);
                            setFilterOpen(false);
                          }}
                          className={`flex w-full items-start gap-3 rounded-[18px] px-4 py-3 text-left transition ${active ? "bg-[rgba(221,241,250,0.96)] text-[var(--primary)]" : "hover:bg-[rgba(240,249,253,0.92)]"}`}
                        >
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${active ? "bg-[var(--brand-strong)]" : "bg-[var(--foreground)]/18"}`} />
                          <span>
                            <span className="block text-base font-black">{option.label}</span>
                            <span className="mt-1 block text-sm text-[var(--foreground)]/56">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="dream-chip inline-flex items-center p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${viewMode === "grid" ? "border-[var(--line-strong)] bg-[var(--button-primary)] text-[var(--foreground)]" : "border-transparent text-[var(--foreground)]/52"}`}
                  aria-label="网格视图"
                >
                  <GridIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${viewMode === "list" ? "border-[var(--line-strong)] bg-[var(--button-primary)] text-[var(--foreground)]" : "border-transparent text-[var(--foreground)]/52"}`}
                  aria-label="列表视图"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {loadError ? (
            <div className="dream-panel-soft mt-8 flex flex-col gap-3 border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button type="button" onClick={() => window.location.reload()} className="btn-subtle w-fit rounded-full border-[#efb893] px-4 py-2 text-sm">
                重新加载
              </button>
            </div>
          ) : null}

          {!loadError && cards.length === 0 ? (
            <EmptyCard title="你还没有可选择的卡片" description="先创建一张卡片，发布后就可以为它配置提取码。也可以先回到提取码管理页查看已有配置。">
              <Link href="/creator/new" className="btn-primary rounded-full px-6 py-3 text-base font-black">
                去创建卡片
              </Link>
              <Link href="/creator/access-codes" className="btn-subtle rounded-full px-6 py-3 text-base font-black text-[var(--foreground)]/72">
                返回提取码管理
              </Link>
            </EmptyCard>
          ) : null}

          {!loadError && cards.length > 0 && filteredCards.length === 0 ? (
            <EmptyCard title="当前筛选下没有卡片" description="你可以切换筛选条件，或者回到全部卡片查看可用项。">
              <button type="button" onClick={() => setVisibilityFilter("all")} className="btn-primary rounded-full px-6 py-3 text-base font-black">
                查看全部卡片
              </button>
            </EmptyCard>
          ) : null}

          {!loadError && filteredCards.length > 0 ? (
            <>
              <div className={`mt-10 ${viewMode === "grid" ? "grid gap-6 md:grid-cols-2 xl:grid-cols-4" : "space-y-4"}`}>
                {filteredCards.map((item) => {
                  const selected = item.card.id === effectiveSelectedCardId;
                  return viewMode === "list" ? (
                    <CardPickerListItem key={item.card.id} item={item} selected={selected} onSelect={setSelectedCardId} />
                  ) : (
                    <CardPickerGridItem key={item.card.id} item={item} selected={selected} onSelect={setSelectedCardId} />
                  );
                })}
              </div>

              <div className="sticky bottom-6 mt-10 flex justify-end">
                <div className="dream-panel flex w-full max-w-[640px] flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm tracking-[0.08em] text-[var(--foreground)]/46">当前已选择卡片</div>
                    <div className="mt-1 truncate text-2xl font-black text-[var(--foreground)]">{selectedCard?.card.title || "请选择一张卡片"}</div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedCard}
                    onClick={handleNext}
                    className="btn-rose inline-flex min-w-[190px] items-center justify-center gap-3 rounded-full px-8 py-4 text-2xl font-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>下一步</span>
                    <ArrowRightIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}



