"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthCard } from "@/components/share/auth-card";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { AccessCodeDashboardItem, DashboardCard, PlatformCard } from "@/lib/shared";

type ViewMode = "grid" | "list";
type VisibilityFilter = "all" | "public" | "private";

const filterOptions: Array<{
  value: VisibilityFilter;
  label: string;
  description: string;
}> = [
  { value: "all", label: "全部", description: "显示全部可生成提取码的卡片" },
  { value: "public", label: "仅公开", description: "只显示公开可见的卡片" },
  { value: "private", label: "仅私密", description: "只显示私密卡片" },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isImageCard(card: PlatformCard) {
  return typeof card.mimeType === "string" && card.mimeType.startsWith("image/") && Boolean(card.previewUrl.trim());
}

function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "UR";
  }
  if (downloadCount >= 30) {
    return "SSR";
  }
  if (downloadCount >= 10) {
    return "SR";
  }
  return "R";
}

function getVisibilityLabel(card: PlatformCard) {
  if (card.visibility === "private") {
    return "私密";
  }
  if (card.status === "draft") {
    return "草稿";
  }
  return "公开";
}

function buildSelectableCards(cards: DashboardCard[], availableIds: Set<string>) {
  return cards
    .filter((item) => availableIds.has(item.card.id))
    .sort((left, right) => new Date(right.card.updatedAt).getTime() - new Date(left.card.updatedAt).getTime());
}

function buildSelectableCardIds(availableCards: PlatformCard[], items: AccessCodeDashboardItem[]) {
  const ids = new Set(availableCards.map((card) => card.id));

  for (const item of items) {
    if (!item.config.isActive || !item.isPubliclyVisible) {
      ids.add(item.card.id);
    }
  }

  return ids;
}

function StepPill({
  active,
  label,
  title,
  icon,
}: {
  active: boolean;
  label: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border text-[var(--brand-strong)] shadow-[0_18px_36px_-30px_rgba(120,85,94,0.35)] ${
          active ? "border-[#e9a2b8] bg-[#ffe9f0]" : "border-white/85 bg-white/80 text-[var(--foreground)]/48"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/42">{label}</div>
        <div className={`text-base font-medium ${active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/52"}`}>{title}</div>
      </div>
    </div>
  );
}

function EmptyCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 rounded-[38px] border border-white/80 bg-white/84 px-6 py-14 text-center shadow-[0_28px_70px_-48px_rgba(120,85,94,0.28)] sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,223,231,0.92)] text-[var(--brand-strong)]">
        <CardIcon className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-3xl font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--foreground)]/62">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </section>
  );
}

export function ShareAccessCodeCardPicker() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCards() {
      setLoading(true);

      try {
        const [accessCodePayload, cardsPayload] = await Promise.all([shareApi.myAccessCodes(), shareApi.myCards()]);
        if (!active) {
          return;
        }

        const availableIds = buildSelectableCardIds(accessCodePayload.availableCards, accessCodePayload.items);
        const nextCards = buildSelectableCards(cardsPayload.cards, availableIds);

        setCards(nextCards);
        setAuthenticated(true);
        setLoadError("");
        setSelectedCardId(nextCards[0]?.card.id ?? "");
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ShareApiError && error.status === 401) {
          setAuthenticated(false);
          setCards([]);
          setLoadError("");
          setSelectedCardId("");
        } else {
          setAuthenticated(true);
          setCards([]);
          setLoadError(getShareErrorMessage(error, "加载可选卡片失败，请稍后重试。"));
          setSelectedCardId("");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCards();

    return () => {
      active = false;
    };
  }, []);

  const filteredCards = useMemo(() => {
    if (visibilityFilter === "all") {
      return cards;
    }
    return cards.filter((item) => item.card.visibility === visibilityFilter);
  }, [cards, visibilityFilter]);

  useEffect(() => {
    if (filteredCards.length === 0) {
      setSelectedCardId("");
      return;
    }

    setSelectedCardId((current) => {
      if (filteredCards.some((item) => item.card.id === current)) {
        return current;
      }
      return filteredCards[0]?.card.id ?? "";
    });
  }, [filteredCards]);

  const selectedCard = useMemo(
    () => filteredCards.find((item) => item.card.id === selectedCardId) ?? null,
    [filteredCards, selectedCardId],
  );

  const footer = useMemo(
    () => (
      <footer className="relative z-10 px-6 pb-10 pt-12 text-center text-sm tracking-[0.08em] text-[var(--brand)]/55">
        © 2024 CardShare
      </footer>
    ),
    [],
  );

  function handleNext() {
    if (!selectedCardId) {
      return;
    }
    router.push(`/creator/cards/${encodeURIComponent(selectedCardId)}/access-code?flow=new-access-code`);
  }

  if (loading && authenticated) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-[1480px] space-y-6">
            <div className="h-28 animate-pulse rounded-[36px] border border-white/80 bg-white/72" />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[440px] animate-pulse rounded-[34px] border border-white/80 bg-white/72" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <AuthCard afterSuccess="/creator/access-codes/new" />
      </div>
    );
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fffafa_0%,#fff7f8_52%,#fff4f7_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[8%] h-[26rem] w-[26rem] rounded-full bg-[rgba(255,214,226,0.34)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-[rgba(244,220,255,0.28)] blur-[120px]" />
          <div className="absolute bottom-[-16%] left-[22%] h-[28rem] w-[28rem] rounded-full bg-[rgba(255,232,238,0.32)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1520px] px-4 pb-20 pt-10 sm:px-6">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                href="/creator/access-codes"
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(226,204,210,0.9)] bg-white/88 px-4 py-2 text-sm text-[var(--foreground)]/72 shadow-[0_16px_36px_-30px_rgba(120,85,94,0.22)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <BackIcon className="h-4.5 w-4.5" />
                <span>返回</span>
              </Link>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/84 px-4 py-2 text-sm font-medium text-[#ef648f] shadow-[0_18px_38px_-28px_rgba(120,85,94,0.25)]">
                <SparkleIcon className="h-4.5 w-4.5" />
                <span>创作工作室</span>
              </div>

              <h1 className="mt-6 text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[3.8rem]">选择卡片</h1>
              <p className="mt-4 max-w-3xl text-xl leading-9 text-[var(--foreground)]/66">
                请从您的画廊中选择一张角色卡片来生成新的提取码。选择那张今天最触动你心弦的卡片吧。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-[32px] border border-white/80 bg-white/76 px-5 py-4 shadow-[0_20px_40px_-34px_rgba(120,85,94,0.24)]">
              <StepPill active label="STEP01" title="选择分享卡片" icon={<HeartIcon className="h-5 w-5" />} />
              <div className="hidden h-px w-12 bg-[rgba(223,198,206,0.9)] lg:block" />
              <StepPill active={false} label="STEP02" title="配置提取规则" icon={<SettingsIcon className="h-5 w-5" />} />
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm tracking-[0.08em] text-[var(--foreground)]/46">
              {cards.length > 0 ? `当前共有 ${cards.length} 张卡片可生成提取码` : "先选择一张卡片，再进入提取规则配置"}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/86 px-5 py-3 text-base text-[var(--foreground)] shadow-[0_18px_38px_-30px_rgba(120,85,94,0.24)] transition hover:-translate-y-0.5"
                >
                  <FilterIcon className="h-5 w-5" />
                  <span>筛选</span>
                </button>

                {filterOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-72 rounded-[28px] border border-white/90 bg-white/96 p-3 shadow-[0_28px_60px_-34px_rgba(120,85,94,0.28)] backdrop-blur-xl">
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
                          className={`flex w-full items-start gap-3 rounded-[22px] px-4 py-3 text-left transition ${
                            active ? "bg-[rgba(255,235,241,0.96)] text-[var(--brand-strong)]" : "hover:bg-[rgba(255,244,247,0.92)]"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full ${
                              active ? "bg-[var(--brand-strong)]" : "bg-[var(--foreground)]/18"
                            }`}
                          />
                          <span>
                            <span className="block text-base font-medium">{option.label}</span>
                            <span className="mt-1 block text-sm text-[var(--foreground)]/56">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="inline-flex items-center rounded-full border border-white/80 bg-white/86 p-1 shadow-[0_18px_38px_-30px_rgba(120,85,94,0.24)]">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition ${
                    viewMode === "grid" ? "bg-[rgba(255,232,238,0.96)] text-[var(--brand-strong)]" : "text-[var(--foreground)]/52"
                  }`}
                  aria-label="网格视图"
                >
                  <GridIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition ${
                    viewMode === "list" ? "bg-[rgba(255,232,238,0.96)] text-[var(--brand-strong)]" : "text-[var(--foreground)]/52"
                  }`}
                  aria-label="列表视图"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {loadError ? (
            <div className="mt-8 flex flex-col gap-3 rounded-[30px] border border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] shadow-[0_20px_40px_-34px_rgba(154,52,18,0.32)] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-fit rounded-full border border-[#efb893] px-4 py-2 text-sm transition hover:bg-white/80"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {!loadError && cards.length === 0 ? (
            <EmptyCard
              title="暂无可生成提取码的卡片"
              description="你当前的卡片都已经配置过提取码，或还没有完成创作。可以先去创作新的卡片，或者回到提取码管理页继续维护已有提取码。"
            >
              <Link
                href="/creator/new"
                className="rounded-full bg-[linear-gradient(135deg,#ffb5c4_0%,#ff99b0_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(255,110,146,0.68)] transition hover:-translate-y-0.5"
              >
                去创作卡片
              </Link>
              <Link
                href="/creator/access-codes"
                className="rounded-full border border-[rgba(226,204,210,0.9)] bg-white px-6 py-3 text-base text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                返回提取码管理
              </Link>
            </EmptyCard>
          ) : null}

          {!loadError && cards.length > 0 && filteredCards.length === 0 ? (
            <EmptyCard
              title="当前筛选条件下没有卡片"
              description="切换筛选条件后再试，或者直接显示全部卡片。选定卡片后即可进入提取规则配置页面。"
            >
              <button
                type="button"
                onClick={() => setVisibilityFilter("all")}
                className="rounded-full bg-[linear-gradient(135deg,#ffb5c4_0%,#ff99b0_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(255,110,146,0.68)] transition hover:-translate-y-0.5"
              >
                显示全部卡片
              </button>
            </EmptyCard>
          ) : null}

          {!loadError && filteredCards.length > 0 ? (
            <>
              <div
                className={`mt-10 ${
                  viewMode === "grid" ? "grid gap-6 md:grid-cols-2 xl:grid-cols-4" : "space-y-4"
                }`}
              >
                {filteredCards.map((item) => {
                  const selected = item.card.id === selectedCardId;
                  const rarityLabel = getRarityLabel(item.stats.downloadCount);

                  if (viewMode === "list") {
                    return (
                      <button
                        key={item.card.id}
                        type="button"
                        onClick={() => setSelectedCardId(item.card.id)}
                        className={`flex w-full flex-col gap-5 rounded-[34px] border p-5 text-left shadow-[0_24px_56px_-40px_rgba(120,85,94,0.2)] transition sm:flex-row sm:items-center ${
                          selected
                            ? "border-[#e8a4b8] bg-[rgba(255,249,251,0.96)]"
                            : "border-white/85 bg-white/84 hover:-translate-y-0.5 hover:border-[rgba(233,164,184,0.72)]"
                        }`}
                      >
                        <div className="relative h-[210px] w-full overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2b1c22_0%,#6f545c_100%)] sm:h-[180px] sm:w-[180px] sm:shrink-0">
                          {isImageCard(item.card) ? (
                            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-lg font-medium text-white/92">
                              {item.card.title}
                            </div>
                          )}

                          <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-semibold text-white">
                            {rarityLabel}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[2rem] font-semibold leading-none text-[var(--foreground)]">{item.card.title}</div>
                              <div className="mt-3 text-sm tracking-[0.08em] text-[var(--foreground)]/48">
                                创建于 {formatDate(item.card.createdAt)}
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                                selected
                                  ? "bg-[rgba(255,232,238,0.96)] text-[var(--brand-strong)]"
                                  : "bg-[rgba(247,243,245,0.94)] text-[var(--foreground)]/56"
                              }`}
                            >
                              {selected ? "已选中" : "点击选择"}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--foreground)]/58">
                            <span className="rounded-full bg-[rgba(255,240,244,0.92)] px-3 py-1">{getVisibilityLabel(item.card)}</span>
                            <span className="rounded-full bg-[rgba(247,243,245,0.94)] px-3 py-1">下载 {item.stats.downloadCount}</span>
                            <span className="rounded-full bg-[rgba(247,243,245,0.94)] px-3 py-1">{item.card.originalFileName}</span>
                          </div>

                          <p className="mt-4 text-base leading-8 text-[var(--foreground)]/62">
                            {item.card.description.trim() || "选中这张卡片后，将进入下一步配置提取码使用规则。"}
                          </p>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={item.card.id}
                      type="button"
                      onClick={() => setSelectedCardId(item.card.id)}
                      className={`group relative overflow-hidden rounded-[36px] border p-3 text-left shadow-[0_28px_64px_-42px_rgba(120,85,94,0.22)] transition ${
                        selected
                          ? "border-[#e8a4b8] bg-[rgba(255,249,251,0.96)]"
                          : "border-white/85 bg-white/84 hover:-translate-y-1 hover:border-[rgba(233,164,184,0.72)]"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#2b1c22_0%,#6f545c_100%)]">
                        {isImageCard(item.card) ? (
                          <img src={item.card.previewUrl} alt={item.card.title} className="aspect-[4/5] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[4/5] items-center justify-center px-5 text-center text-xl font-medium text-white/92">
                            {item.card.title}
                          </div>
                        )}

                        <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-semibold text-white">
                          {rarityLabel}
                        </span>

                        <span
                          className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full shadow-[0_12px_28px_-16px_rgba(0,0,0,0.35)] ${
                            selected ? "bg-[#fff1f5] text-[var(--brand-strong)]" : "bg-white/90 text-[#8c6772]"
                          }`}
                        >
                          <HeartIcon className="h-5 w-5" />
                        </span>

                        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,12,15,0)_0%,rgba(17,12,15,0.82)_100%)] px-5 pb-5 pt-16">
                          <div className="inline-flex rounded-full bg-white/18 px-3 py-1 text-xs tracking-[0.08em] text-white/92">
                            {getVisibilityLabel(item.card)}
                          </div>
                          <div className="mt-4 text-[2rem] font-semibold leading-none text-white">{item.card.title}</div>
                        </div>

                        {selected ? (
                          <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-2 ring-[#f2b0c2] ring-offset-2 ring-offset-white/40" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="sticky bottom-6 mt-10 flex justify-end">
                <div className="flex w-full max-w-[580px] flex-col gap-4 rounded-[32px] border border-white/85 bg-white/90 px-5 py-5 shadow-[0_28px_60px_-36px_rgba(120,85,94,0.32)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm tracking-[0.08em] text-[var(--foreground)]/46">已选择分享卡片</div>
                    <div className="mt-1 truncate text-2xl font-semibold text-[var(--foreground)]">
                      {selectedCard?.card.title || "请选择一张卡片"}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedCard}
                    onClick={handleNext}
                    className="inline-flex min-w-[190px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#f7d1e8_0%,#f7c0f2_100%)] px-8 py-4 text-2xl font-semibold text-[#3f2731] shadow-[0_20px_44px_-26px_rgba(214,113,145,0.42)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 2 1.56 4.44L18 8l-4.44 1.56L12 14l-1.56-4.44L6 8l4.44-1.56L12 2Zm-6 12 1.04 2.96L10 18l-2.96 1.04L6 22l-1.04-2.96L2 18l2.96-1.04L6 14Zm12 1 1.04 2.96L22 19l-2.96 1.04L18 23l-1.04-2.96L14 19l2.96-1.04L18 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FilterIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 6h15v1.5h-15V6Zm3 5.25h9v1.5h-9v-1.5Zm3 5.25h3v1.5h-3v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4.5 4.5h6.75v6.75H4.5V4.5Zm1.5 1.5v3.75h3.75V6H6Zm6.75-1.5h6.75v6.75h-6.75V4.5Zm1.5 1.5v3.75H18V6h-3.75ZM4.5 12.75h6.75v6.75H4.5v-6.75Zm1.5 1.5V18h3.75v-3.75H6Zm6.75-1.5h6.75v6.75h-6.75v-6.75Zm1.5 1.5V18H18v-3.75h-3.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ListIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5.25 6h13.5v1.5H5.25V6Zm0 5.25h13.5v1.5H5.25v-1.5Zm0 5.25h13.5V18H5.25v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3.75 1.07 1.94 2.2.39 1.56-1.6 1.59 1.58-1.61 1.6.4 2.2 1.89 1.09-.63 2.18-2.18-.02-1.55 1.59.38 2.18-2.11.85-1.01-1.93-2.19-.01-1.02 1.93-2.1-.85.38-2.18-1.55-1.59-2.18.02-.63-2.18 1.89-1.09.4-2.2-1.61-1.6 1.59-1.58 1.56 1.6 2.2-.39L12 3.75Zm0 5.25A3 3 0 1 0 12 15a3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 4.5h9A3.75 3.75 0 0 1 20.25 8.25v7.5A3.75 3.75 0 0 1 16.5 19.5h-9a3.75 3.75 0 0 1-3.75-3.75v-7.5A3.75 3.75 0 0 1 7.5 4.5Zm0 1.5A2.25 2.25 0 0 0 5.25 8.25v.75h13.5v-.75A2.25 2.25 0 0 0 16.5 6h-9Zm11.25 4.5H5.25v5.25A2.25 2.25 0 0 0 7.5 18h9a2.25 2.25 0 0 0 2.25-2.25V10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.94 5.47 1.06 1.06-4.47 4.47h9.47v1.5H10.53l4.47 4.47-1.06 1.06L7.66 12l6.28-6.53Z" fill="currentColor" />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}
