"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { UnifiedFooter } from "@/components/share/unified-footer";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { AccessCodeDashboardItem, DashboardCard, PlatformCard } from "@/lib/shared";

type ViewMode = "grid" | "list";
type VisibilityFilter = "all" | "public" | "private";

const filterOptions: Array<{
  value: VisibilityFilter;
  label: string;
  description: string;
}> = [
  { value: "all", label: "全部卡片", description: "显示你可用于创建提取码的所有卡片" },
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

function pickSelectedCardId(cards: DashboardCard[], currentId: string) {
  if (cards.length === 0) {
    return "";
  }
  if (cards.some((item) => item.card.id === currentId)) {
    return currentId;
  }
  return cards[0]?.card.id ?? "";
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
        className={`dream-chip flex h-11 w-11 items-center justify-center ${
          active ? "bg-[var(--button-rose)] text-[var(--foreground)]" : "text-[var(--foreground)]/55"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/42">{label}</div>
        <div className={`text-base font-black ${active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/56"}`}>{title}</div>
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
    <section className="dream-panel mt-10 px-6 py-14 text-center sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,223,231,0.92)] text-[var(--brand-strong)]">
        <CardIcon className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-3xl font-black text-[var(--foreground)]">{title}</h2>
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
          setLoadError(getShareErrorMessage(error, "加载卡片失败，请稍后重试"));
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

  const effectiveSelectedCardId = useMemo(() => pickSelectedCardId(filteredCards, selectedCardId), [filteredCards, selectedCardId]);

  const selectedCard = useMemo(
    () => filteredCards.find((item) => item.card.id === effectiveSelectedCardId) ?? null,
    [effectiveSelectedCardId, filteredCards],
  );

  function handleNext() {
    if (!effectiveSelectedCardId) {
      return;
    }
    router.push(`/creator/cards/${encodeURIComponent(effectiveSelectedCardId)}/access-code?flow=new-access-code`);
  }

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
              <Link
                href="/creator/access-codes"
                className="btn-subtle inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-[var(--foreground)]/72 transition hover:-translate-y-0.5"
              >
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
              {cards.length > 0
                ? `当前共有 ${cards.length} 张可用于生成提取码的卡片`
                : "还没有可用于生成提取码的卡片，先创建一张卡片吧"}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="dream-chip inline-flex items-center gap-2 px-5 py-3 text-base font-black text-[var(--foreground)] transition hover:-translate-y-0.5"
                >
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
                          className={`flex w-full items-start gap-3 rounded-[18px] px-4 py-3 text-left transition ${
                            active ? "bg-[rgba(221,241,250,0.96)] text-[var(--primary)]" : "hover:bg-[rgba(240,249,253,0.92)]"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full ${
                              active ? "bg-[var(--brand-strong)]" : "bg-[var(--foreground)]/18"
                            }`}
                          />
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
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                    viewMode === "grid"
                      ? "border-[var(--line-strong)] bg-[var(--button-primary)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--foreground)]/52"
                  }`}
                  aria-label="网格视图"
                >
                  <GridIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                    viewMode === "list"
                      ? "border-[var(--line-strong)] bg-[var(--button-primary)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--foreground)]/52"
                  }`}
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
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-subtle w-fit rounded-full border-[#efb893] px-4 py-2 text-sm"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {!loadError && cards.length === 0 ? (
            <EmptyCard
              title="你还没有可选择的卡片"
              description="先创建一张卡片，发布后就可以为它配置提取码。也可以先回到提取码管理页查看已有配置。"
            >
              <Link href="/creator/new" className="btn-primary rounded-full px-6 py-3 text-base font-black">
                去创建卡片
              </Link>
              <Link
                href="/creator/access-codes"
                className="btn-subtle rounded-full px-6 py-3 text-base font-black text-[var(--foreground)]/72"
              >
                返回提取码管理
              </Link>
            </EmptyCard>
          ) : null}

          {!loadError && cards.length > 0 && filteredCards.length === 0 ? (
            <EmptyCard title="当前筛选下没有卡片" description="你可以切换筛选条件，或者回到全部卡片查看可用项。">
              <button
                type="button"
                onClick={() => setVisibilityFilter("all")}
                className="btn-primary rounded-full px-6 py-3 text-base font-black"
              >
                查看全部卡片
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
                  const selected = item.card.id === effectiveSelectedCardId;
                  const rarityLabel = getRarityLabel(item.stats.downloadCount);

                  if (viewMode === "list") {
                    return (
                      <button
                        key={item.card.id}
                        type="button"
                        onClick={() => setSelectedCardId(item.card.id)}
                        className={`dream-panel-soft flex w-full flex-col gap-5 p-5 text-left transition sm:flex-row sm:items-center ${
                          selected ? "border-[var(--brand-strong)] bg-[#fff8fb]" : "hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="relative h-[210px] w-full overflow-hidden rounded-[24px] bg-[#2d2327] sm:h-[180px] sm:w-[180px] sm:shrink-0">
                          {isImageCard(item.card) ? (
                            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-lg font-black text-white/92">
                              {item.card.title}
                            </div>
                          )}

                          <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-black text-white">
                            {rarityLabel}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[2rem] font-black leading-none text-[var(--foreground)]">{item.card.title}</div>
                              <div className="mt-3 text-sm tracking-[0.08em] text-[var(--foreground)]/48">
                                创建时间：{formatDate(item.card.createdAt)}
                              </div>
                            </div>

                            <span
                              className={`dream-chip inline-flex items-center px-4 py-2 text-sm font-black ${
                                selected ? "bg-[#fff1f6] text-[var(--brand-strong)]" : "text-[var(--foreground)]/56"
                              }`}
                            >
                              {selected ? "已选中" : "点击选择"}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--foreground)]/58">
                            <span className="dream-chip px-3 py-1">{getVisibilityLabel(item.card)}</span>
                            <span className="dream-chip px-3 py-1">下载 {item.stats.downloadCount}</span>
                            <span className="dream-chip px-3 py-1">{item.card.originalFileName}</span>
                          </div>

                          <p className="mt-4 text-base leading-8 text-[var(--foreground)]/62">
                            {item.card.description.trim() || "这张卡片还没有填写描述，进入编辑页可以补充内容。"}
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
                      className={`dream-panel-soft group relative overflow-hidden p-3 text-left transition ${
                        selected ? "border-[var(--brand-strong)] bg-[#fff8fb]" : "hover:-translate-y-1"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-[26px] bg-[#2d2327]">
                        {isImageCard(item.card) ? (
                          <img src={item.card.previewUrl} alt={item.card.title} className="aspect-[4/5] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[4/5] items-center justify-center px-5 text-center text-xl font-black text-white/92">
                            {item.card.title}
                          </div>
                        )}

                        <span className="absolute left-4 top-4 rounded-full bg-[rgba(28,17,23,0.72)] px-3 py-1 text-sm font-black text-white">
                          {rarityLabel}
                        </span>

                        <span
                          className={`dream-chip absolute right-4 top-4 flex h-11 w-11 items-center justify-center ${
                            selected ? "bg-[#fff1f5] text-[var(--brand-strong)]" : "text-[#8c6772]"
                          }`}
                        >
                          <HeartIcon className="h-5 w-5" />
                        </span>

                        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,12,15,0)_0%,rgba(17,12,15,0.82)_100%)] px-5 pb-5 pt-16">
                          <div className="inline-flex rounded-full bg-white/18 px-3 py-1 text-xs tracking-[0.08em] text-white/92">
                            {getVisibilityLabel(item.card)}
                          </div>
                          <div className="mt-4 text-[2rem] font-black leading-none text-white">{item.card.title}</div>
                        </div>

                        {selected ? (
                          <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[var(--button-rose)] ring-offset-2 ring-offset-white/40" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="sticky bottom-6 mt-10 flex justify-end">
                <div className="dream-panel flex w-full max-w-[640px] flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm tracking-[0.08em] text-[var(--foreground)]/46">当前已选择卡片</div>
                    <div className="mt-1 truncate text-2xl font-black text-[var(--foreground)]">
                      {selectedCard?.card.title || "请选择一张卡片"}
                    </div>
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
