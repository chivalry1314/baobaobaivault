"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { PaginationControls } from "@/components/share/pagination-controls";
import { ShareProfileSettings } from "@/components/share/share-profile-settings";
import { UnifiedFooter } from "@/components/share/unified-footer";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { DashboardCard, DashboardResponse, ExternalSessionUser, PlatformCard } from "@/lib/shared";

type ActiveTab = "cards" | "collections" | "history";
type ActiveSection = "dashboard" | "settings";

const CARDS_PAGE_SIZE = 9;
const HISTORY_PAGE_SIZE = 8;

function formatDate(value: string | null | undefined) {
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
  }).format(date);
}

function formatUid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) % 900000;
  }
  return String(hash + 100000);
}

function formatCardCode(cardId: string) {
  return cardId.replace(/-/g, "").slice(0, 10).toUpperCase();
}

function formatMetricValue(value: number) {
  if (value < 1000) {
    return String(value);
  }
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(value)
    .toUpperCase();
}

function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }
  const username = user.username.trim();
  if (username) {
    return username;
  }
  return user.email.split("@")[0]?.trim() || "Card Share";
}

function getInitials(name: string) {
  const clean = name.trim();
  if (!clean) {
    return "CS";
  }
  return Array.from(clean).slice(0, 2).join("").toUpperCase();
}

function getUserTagline(user: ExternalSessionUser | null) {
  if (!user) {
    return "";
  }
  const bio = user.bio.trim();
  if (bio) {
    return bio;
  }
  return "在 Card Share 展示你的创作，让更多人看见你的灵感。";
}

function isImageCard(card: PlatformCard) {
  return typeof card.mimeType === "string" && card.mimeType.startsWith("image/") && Boolean(card.previewUrl.trim());
}

function getCardRank(item: DashboardCard) {
  if (item.stats.downloadCount >= 50) {
    return { label: "SSR", className: "bg-[#ffe06f] text-[#6d3a00]" };
  }
  if (item.stats.downloadCount >= 10) {
    return { label: "SR", className: "bg-[#f4c7df] text-[#6c3756]" };
  }
  return { label: "R", className: "bg-[#d4f0ff] text-[#255d72]" };
}

function getVisibilityLabel(value: PlatformCard["visibility"]) {
  return value === "public" ? "公开" : "私密";
}

function getStatusLabel(value: PlatformCard["status"]) {
  switch (value) {
    case "published":
      return "已发布";
    case "draft":
      return "草稿";
    default:
      return "已归档";
  }
}

function getReviewStatusLabel(value: PlatformCard["reviewStatus"]) {
  switch (value) {
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

function defaultCardDescription(card: PlatformCard) {
  const text = card.description.trim();
  if (text) {
    return text;
  }
  return "这张卡片还没有填写描述，点击管理可补充详情。";
}

function Avatar({ user, size = "lg" }: { user: ExternalSessionUser; size?: "sm" | "lg" }) {
  const name = getDisplayName(user);
  const dimension = size === "sm" ? "h-14 w-14" : "h-28 w-28";
  const inner = size === "sm" ? "text-lg" : "text-3xl";

  if (user.avatar.trim()) {
    return <img src={user.avatar} alt={name} className={`${dimension} rounded-full object-cover shadow-[0_16px_36px_-24px_rgba(120,85,94,0.5)]`} />;
  }

  return <div className={`${dimension} btn-subtle flex items-center justify-center rounded-full font-black shadow-[0_16px_36px_-24px_rgba(55,98,120,0.35)] ${inner}`}>{getInitials(name)}</div>;
}

function SidebarButton({
  active = false,
  href,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className = `flex w-full items-center gap-3 rounded-full px-5 py-4 text-base font-black transition ${
    active ? "btn-subtle text-[var(--primary)] shadow-[0_18px_36px_-26px_rgba(57,124,153,0.35)]" : "text-[var(--foreground)]/74 hover:bg-white/78 hover:text-[var(--primary)]"
  }`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-h3 border-b-2 pb-4 transition ${active ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"}`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="dream-panel px-6 py-14 text-center">
      <p className="type-h2 text-[var(--foreground)]">{title}</p>
      <p className="type-body-sm mx-auto mt-3 max-w-xl text-[var(--foreground)]/62">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-black">
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn-primary mt-6 rounded-full px-6 py-3 text-sm font-black">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function CreatorCard({ item }: { item: DashboardCard }) {
  const rank = getCardRank(item);
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const accessCodeHref = `/creator/cards/${encodeURIComponent(item.card.id)}/access-code`;
  const accessCode = item.accessCode?.trim() ?? "";
  const hasInlineAccessCode = accessCode.length > 0;

  return (
    <article className="dream-panel p-4">
      <Link href={editHref} className="relative block overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#20161a_0%,#3f2b32_100%)]">
        {isImageCard(item.card) ? (
          <img src={item.card.previewUrl} alt={item.card.title} className="h-[212px] w-full object-cover" />
        ) : (
          <div className="flex h-[212px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] px-4 text-center text-lg font-black text-white/92">{item.card.title}</div>
        )}
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-black ${rank.className}`}>{rank.label}</span>
        <span className="dream-chip absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-[var(--primary)]">
          <HeartIcon className="h-5 w-5" />
        </span>
      </Link>

      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={editHref} className="type-h2 block text-[var(--foreground)]">
              {item.card.title}
            </Link>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">{getVisibilityLabel(item.card.visibility)}</span>
            <span className="dream-chip px-3 py-1 text-xs text-[var(--foreground)]/62">{getReviewStatusLabel(item.card.reviewStatus)}</span>
          </div>
        </div>
        <p className="type-body-sm mt-2 line-clamp-2 min-h-[3rem] text-[var(--foreground)]/72">{defaultCardDescription(item.card)}</p>
      </div>

      <div className="mt-3 border-t border-dashed border-[var(--outline-variant)] pt-3">
        <div className="dream-panel-soft px-3.5 py-3">
          {hasInlineAccessCode ? (
            <div className="flex items-center justify-between gap-3">
              <code className="max-w-[70%] truncate rounded-full border border-[var(--outline-variant)] bg-white/65 px-3 py-1 text-sm font-black tracking-[0.12em] text-[var(--primary)]">{accessCode}</code>
              <Link href={accessCodeHref} className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]">
                去管理
              </Link>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="type-body-sm tracking-[0.06em] text-[var(--primary)]">未配置</div>
                <div className="mt-1 text-xs text-[var(--text-subtle)]">点击右侧按钮进入提取码管理</div>
              </div>
              <Link href={accessCodeHref} className="btn-subtle shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[var(--primary)]">
                去管理
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function HistoryItem({ item }: { item: DashboardCard }) {
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  return (
    <article className="dream-panel-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={editHref} className="block h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)]">
          {isImageCard(item.card) ? (
            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm font-black text-white/92">{item.card.title}</div>
          )}
        </Link>

        <div className="min-w-0">
          <Link href={editHref} className="block truncate text-xl font-black text-[var(--foreground)]">
            {item.card.title}
          </Link>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">
            更新时间：{formatDate(item.card.updatedAt)}，当前状态：{getStatusLabel(item.card.status)} / {getReviewStatusLabel(item.card.reviewStatus)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <span className="dream-chip px-3 py-1">{getVisibilityLabel(item.card.visibility)}</span>
            <span className="dream-chip px-3 py-1">下载 {item.stats.downloadCount} 次</span>
            <span className="dream-chip px-3 py-1">编号 {formatCardCode(item.card.id)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CreatorStudio() {
  const router = useRouter();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("cards");
  const [cardsPage, setCardsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const cards = useMemo(() => dashboard?.cards ?? [], [dashboard?.cards]);
  const displayName = useMemo(() => (currentUser ? getDisplayName(currentUser) : ""), [currentUser]);

  const accountLabel = useMemo(() => {
    if (!currentUser) {
      return "";
    }
    const username = currentUser.username.trim();
    return username ? `@${username}` : currentUser.email;
  }, [currentUser]);

  const heroStats = useMemo(
    () => [
      { value: formatMetricValue(dashboard?.stats.totalCards ?? 0), label: "卡片总数" },
      { value: formatMetricValue(dashboard?.stats.totalPublic ?? 0), label: "公开卡片" },
      { value: formatMetricValue(dashboard?.stats.totalDownloads ?? 0), label: "累计下载", accent: true },
    ],
    [dashboard],
  );

  const historyItems = useMemo(() => {
    return [...cards].sort((left, right) => new Date(right.card.updatedAt).getTime() - new Date(left.card.updatedAt).getTime());
  }, [cards]);

  const cardsTotalPages = useMemo(() => Math.max(1, Math.ceil(cards.length / CARDS_PAGE_SIZE)), [cards.length]);
  const historyTotalPages = useMemo(() => Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE)), [historyItems.length]);

  const pagedCards = useMemo(() => {
    const safePage = Math.min(Math.max(cardsPage, 1), cardsTotalPages);
    const start = (safePage - 1) * CARDS_PAGE_SIZE;
    return cards.slice(start, start + CARDS_PAGE_SIZE);
  }, [cards, cardsPage, cardsTotalPages]);

  const pagedHistoryItems = useMemo(() => {
    const safePage = Math.min(Math.max(historyPage, 1), historyTotalPages);
    const start = (safePage - 1) * HISTORY_PAGE_SIZE;
    return historyItems.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyItems, historyPage, historyTotalPages]);

  useEffect(() => {
    setCardsPage(1);
    setHistoryPage(1);
  }, [dashboard]);

  useEffect(() => {
    setCardsPage((current) => Math.min(Math.max(current, 1), cardsTotalPages));
  }, [cardsTotalPages]);

  useEffect(() => {
    setHistoryPage((current) => Math.min(Math.max(current, 1), historyTotalPages));
  }, [historyTotalPages]);

  const heroSurfaceStyle = useMemo(() => {
    if (!currentUser?.coverImage.trim()) {
      return undefined;
    }
    return {
      backgroundImage: `linear-gradient(135deg,rgba(255,255,255,0.84) 0%,rgba(232,247,252,0.76) 52%,rgba(244,251,255,0.88) 100%), url(${currentUser.coverImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [currentUser]);

  const loadDashboard = useCallback(async () => {
    const [cardsPayload, accessCodesPayload] = await Promise.all([shareApi.myCards(), shareApi.myAccessCodes().catch(() => null)]);

    const activeAccessCodeByCardId = new Map<string, string>();
    const hasConfiguredAccessCodeCardIds = new Set<string>();
    if (accessCodesPayload) {
      for (const item of accessCodesPayload.items) {
        const code = item.config.code.trim();
        if (code) {
          hasConfiguredAccessCodeCardIds.add(item.card.id);
          if (item.config.isActive && item.isPubliclyVisible) {
            activeAccessCodeByCardId.set(item.card.id, code);
          }
        }
      }
    }

    const mergedCards = cardsPayload.cards.map((cardItem) => {
      const mergedCode = activeAccessCodeByCardId.get(cardItem.card.id) ?? "";
      const hasConfiguredCode = hasConfiguredAccessCodeCardIds.has(cardItem.card.id) || cardItem.hasAccessCode;
      return {
        ...cardItem,
        hasAccessCode: hasConfiguredCode,
        accessCode: mergedCode || undefined,
      };
    });

    setCurrentUser(cardsPayload.user);
    setDashboard({ ...cardsPayload, cards: mergedCards });
    setLoadError("");
  }, []);

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
          setDashboard(null);
          return;
        }
        setCurrentUser(session.user);
        try {
          await loadDashboard();
        } catch (error) {
          if (!active) {
            return;
          }
          setLoadError(getShareErrorMessage(error, "加载创作中心失败，请稍后重试。"));
          setDashboard(null);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(getShareErrorMessage(error, "会话校验失败，请刷新页面后重试。"));
        setCurrentUser(null);
        setDashboard(null);
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
  }, [loadDashboard]);

  function handleProfileSaved(user: ExternalSessionUser) {
    setCurrentUser(user);
    setDashboard((current) => (current ? { ...current, user } : current));
  }

  function openCreatePanel() {
    router.push("/creator/new");
  }

  async function handleReload() {
    try {
      await loadDashboard();
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "重新加载失败，请稍后重试"));
    }
  }

  async function handleLogout() {
    await shareApi.logout().catch(() => null);
    setCurrentUser(null);
    setDashboard(null);
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="dream-panel mx-auto max-w-7xl px-6 py-14 text-center text-[var(--foreground)]/72">正在加载创作中心...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath="/creator" />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f9fdff_45%,#f2faff_100%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-12 h-80 w-80 rounded-full bg-[rgba(172,228,247,0.36)] blur-3xl" />
        <div className="absolute right-[-80px] top-52 h-80 w-80 rounded-full bg-[rgba(200,233,248,0.3)] blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-[rgba(248,219,230,0.26)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[var(--layout-max)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="dream-panel p-6 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-10 lg:min-h-[calc(100vh-3rem)]">
            <div>
              <div className="flex items-center gap-4">
                <Avatar user={currentUser} size="sm" />
                <div className="min-w-0">
                  <p className="type-h3 truncate text-[var(--foreground)]">{displayName}</p>
                  <p className="type-body-sm mt-1 text-[var(--text-muted)]">UID: {formatUid(currentUser.id)}</p>
                </div>
              </div>

              <div className="mt-10 space-y-3">
                <SidebarButton href="/" icon={<HomeIcon className="h-5 w-5" />}>
                  返回首页
                </SidebarButton>
                <SidebarButton active={activeSection === "dashboard"} onClick={() => setActiveSection("dashboard")} icon={<CardIcon className="h-5 w-5" />}>
                  卡片管理
                </SidebarButton>
                <SidebarButton href="/creator/access-codes" icon={<KeyIcon className="h-5 w-5" />}>
                  提取码管理
                </SidebarButton>
                {currentUser.role === "manager" ? (
                  <SidebarButton href="/creator/reviews" icon={<ReviewIcon className="h-5 w-5" />}>
                    审核中心
                  </SidebarButton>
                ) : null}
                <SidebarButton active={activeSection === "settings"} onClick={() => setActiveSection("settings")} icon={<SettingsIcon className="h-5 w-5" />}>
                  个人资料设置
                </SidebarButton>
              </div>
            </div>

            <button type="button" onClick={handleLogout} className="btn-subtle rounded-full px-4 py-3 text-sm font-black text-[var(--foreground)]/68 lg:mt-auto">
              退出登录
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          {loadError ? (
            <div className="dream-panel-soft flex flex-col gap-3 border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button type="button" onClick={() => void handleReload()} className="btn-subtle w-fit rounded-full border-[#f1b18a] px-4 py-2 text-sm">
                重新加载
              </button>
            </div>
          ) : null}

          {activeSection === "dashboard" ? (
            <>
              <section className="dream-panel overflow-hidden p-3">
                <div
                  className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,rgba(255,255,255,0.94) 0%,rgba(233,247,252,0.86) 52%,rgba(246,252,255,0.95) 100%)] px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
                  style={heroSurfaceStyle}
                >
                  <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                      <div className="rounded-full border-[6px] border-white/90 bg-white/85 p-1 shadow-[0_22px_54px_-34px_rgba(120,85,94,0.45)]">
                        <Avatar user={currentUser} />
                      </div>
                      <div className="max-w-2xl">
                        <p className="type-overline text-[var(--primary)]/55">Card Share</p>
                        <h1 className="type-hero mt-3 text-[var(--foreground)]">{displayName}</h1>
                        <p className="type-h3 mt-3 text-[var(--foreground)]/68">{getUserTagline(currentUser)}</p>
                        <p className="type-body-sm mt-4 text-[var(--text-subtle)]">{accountLabel}</p>
                      </div>
                    </div>

                    <div className="dream-panel-soft grid gap-3 p-4 sm:grid-cols-3">
                      {heroStats.map((item) => (
                        <div key={item.label} className="min-w-[112px] rounded-[22px] px-4 py-4 text-center">
                          <div className={`type-h2 ${item.accent ? "text-[var(--brand-strong)]" : "text-[var(--foreground)]"}`}>{item.value}</div>
                          <div className={`type-body-sm mt-1 ${item.accent ? "text-[var(--brand)]" : "text-[var(--foreground)]/62"}`}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="dream-panel px-6 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-6">
                    <TabButton
                      active={activeTab === "cards"}
                      onClick={() => {
                        setActiveTab("cards");
                        setCardsPage(1);
                      }}
                    >
                      我的卡片
                    </TabButton>
                    <TabButton active={activeTab === "collections"} onClick={() => setActiveTab("collections")}>
                      收藏夹
                    </TabButton>
                    <TabButton
                      active={activeTab === "history"}
                      onClick={() => {
                        setActiveTab("history");
                        setHistoryPage(1);
                      }}
                    >
                      最近更新
                    </TabButton>
                  </div>

                  <button type="button" onClick={openCreatePanel} className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
                    <PlusIcon className="h-4 w-4" />
                    新建卡片
                  </button>
                </div>

                <div className="pt-6">
                  {activeTab === "cards" ? (
                    cards.length > 0 ? (
                      <div className="space-y-5">
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          {pagedCards.map((item) => (
                            <CreatorCard key={item.card.id} item={item} />
                          ))}
                        </div>
                        <PaginationControls page={cardsPage} totalPages={cardsTotalPages} onPageChange={(nextPage) => setCardsPage(Math.min(Math.max(nextPage, 1), cardsTotalPages))} />
                      </div>
                    ) : (
                      <EmptyState title="还没有卡片内容" description="点击右上角新建卡片，上传素材并填写描述后即可开始分享。" actionLabel="创建第一张卡片" onAction={openCreatePanel} />
                    )
                  ) : null}

                  {activeTab === "collections" ? (
                    <EmptyState title="收藏功能即将上线" description="你很快可以在这里管理收藏的卡片内容，先去首页浏览更多作品吧。" actionLabel="前往首页" actionHref="/" />
                  ) : null}

                  {activeTab === "history" ? (
                    historyItems.length > 0 ? (
                      <div className="space-y-5">
                        <div className="space-y-4">
                          {pagedHistoryItems.map((item) => (
                            <HistoryItem key={item.card.id} item={item} />
                          ))}
                        </div>
                        <PaginationControls page={historyPage} totalPages={historyTotalPages} onPageChange={(nextPage) => setHistoryPage(Math.min(Math.max(nextPage, 1), historyTotalPages))} />
                      </div>
                    ) : (
                      <EmptyState title="暂无更新记录" description="当你创建或编辑卡片后，这里会展示最近的更新时间线。" actionLabel="去创建卡片" onAction={openCreatePanel} />
                    )
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <ShareProfileSettings user={currentUser} onSaved={handleProfileSaved} />
          )}
        </main>
      </div>

      <UnifiedFooter />
    </div>
  );
}

function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 3.75 3.75 10.3V20.25h5.25V14.5h6v5.75h5.25V10.3L12 3.75Z" fill="currentColor" />
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

function KeyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M13.5 6a4.5 4.5 0 1 0 3.96 6.64l4.79.01v1.5h-1.5v1.5h-1.5v1.5h-2.25V15.9h-1.33A4.5 4.5 0 0 0 13.5 6Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="currentColor"
      />
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

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12h-5.25v-1.5h5.25V5.25Z" fill="currentColor" />
    </svg>
  );
}

function ReviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M6.75 3.75h10.5A2.25 2.25 0 0 1 19.5 6v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Zm0 1.5a.75.75 0 0 0-.75.75v12c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H6.75Zm1.5 3h7.5v1.5h-7.5v-1.5Zm0 3.75h7.5v1.5h-7.5V12Zm0 3.75h4.5v1.5h-4.5v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
