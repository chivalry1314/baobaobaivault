import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { matchesAccessModeFilter, type ShareAccessModeFilter } from "@/components/share/access-mode-filter";
import { CARDS_PAGE_SIZE, formatMetricValue, getDisplayName, HISTORY_PAGE_SIZE } from "@/components/share/creator-studio/helpers";
import type { ActiveSection, ActiveTab } from "@/components/share/creator-studio/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { DashboardResponse, ExternalSessionUser } from "@/lib/shared";

export function useCreatorStudio() {
  const router = useRouter();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("cards");
  const [accessModeFilter, setAccessModeFilter] = useState<ShareAccessModeFilter>("all");
  const [cardsPage, setCardsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const allCards = useMemo(() => dashboard?.cards ?? [], [dashboard?.cards]);
  const cards = useMemo(
    () => allCards.filter((item) => matchesAccessModeFilter(item.card.accessMode, accessModeFilter)),
    [accessModeFilter, allCards],
  );
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
  }, [dashboard, accessModeFilter]);

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

  return {
    sessionChecking,
    currentUser,
    dashboard,
    loadError,
    activeSection,
    setActiveSection,
    activeTab,
    setActiveTab,
    accessModeFilter,
    setAccessModeFilter,
    cardsPage,
    setCardsPage,
    historyPage,
    setHistoryPage,
    cards,
    displayName,
    accountLabel,
    heroStats,
    historyItems,
    cardsTotalPages,
    historyTotalPages,
    pagedCards,
    pagedHistoryItems,
    heroSurfaceStyle,
    handleProfileSaved,
    openCreatePanel,
    handleReload,
    handleLogout,
  };
}
