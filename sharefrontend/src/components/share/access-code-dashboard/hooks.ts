import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  matchesAccessModeFilter,
  type ShareAccessModeFilter,
} from "@/components/share/access-mode-filter";
import {
  ACCESS_CODES_PAGE_SIZE,
  buildCardShareLink,
  CARDS_WITHOUT_CODE_PAGE_SIZE,
  copyText,
  isActiveItem,
} from "@/components/share/access-code-dashboard/helpers";
import type { FeedbackState } from "@/components/share/access-code-dashboard/types";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  AccessCodeDashboardItem,
  AccessCodeDashboardResponse,
} from "@/lib/shared";

export function useShareAccessCodeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [dashboard, setDashboard] =
    useState<AccessCodeDashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [searchValue, setSearchValue] = useState("");
  const [accessModeFilter, setAccessModeFilter] =
    useState<ShareAccessModeFilter>("all");
  const [pendingAction, setPendingAction] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const [cardsWithoutCodePage, setCardsWithoutCodePage] = useState(1);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const payload = await shareApi.myAccessCodes();
      setDashboard(payload);
      setAuthenticated(true);
      setLoadError("");
    } catch (error) {
      if (error instanceof ShareApiError && error.status === 401) {
        setAuthenticated(false);
        setDashboard(null);
        setLoadError("");
      } else {
        setAuthenticated(true);
        setLoadError(
          getShareErrorMessage(error, "提取码数据加载失败，请稍后重试。"),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    const source = dashboard?.items ?? [];
    const keyword = searchValue.trim().toLowerCase();

    const sorted = [...source].sort((left, right) => {
      const activeDiff = Number(isActiveItem(right)) - Number(isActiveItem(left));
      if (activeDiff !== 0) {
        return activeDiff;
      }
      return (
        new Date(right.card.updatedAt).getTime() -
        new Date(left.card.updatedAt).getTime()
      );
    });

    return sorted.filter((item) => {
      if (!matchesAccessModeFilter(item.card.accessMode, accessModeFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        item.card.title,
        item.card.description,
        item.card.originalFileName,
        item.config.code,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [accessModeFilter, dashboard, searchValue]);

  const availableCards = dashboard?.availableCards ?? [];
  const cardsWithoutCode = useMemo(() => {
    const configuredIds = new Set(
      (dashboard?.items ?? []).map((item) => item.card.id),
    );
    return availableCards.filter(
      (card) =>
        !configuredIds.has(card.id) &&
        matchesAccessModeFilter(card.accessMode, accessModeFilter),
    );
  }, [accessModeFilter, availableCards, dashboard?.items]);

  const cardsWithoutCodeTotalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(cardsWithoutCode.length / CARDS_WITHOUT_CODE_PAGE_SIZE),
      ),
    [cardsWithoutCode.length],
  );

  const pagedCardsWithoutCode = useMemo(() => {
    const safePage = Math.min(
      Math.max(cardsWithoutCodePage, 1),
      cardsWithoutCodeTotalPages,
    );
    const start = (safePage - 1) * CARDS_WITHOUT_CODE_PAGE_SIZE;
    return cardsWithoutCode.slice(start, start + CARDS_WITHOUT_CODE_PAGE_SIZE);
  }, [cardsWithoutCode, cardsWithoutCodePage, cardsWithoutCodeTotalPages]);

  const totalItems = dashboard?.items.length ?? 0;
  const itemsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / ACCESS_CODES_PAGE_SIZE)),
    [items.length],
  );

  const pagedItems = useMemo(() => {
    const safePage = Math.min(Math.max(itemsPage, 1), itemsTotalPages);
    const start = (safePage - 1) * ACCESS_CODES_PAGE_SIZE;
    return items.slice(start, start + ACCESS_CODES_PAGE_SIZE);
  }, [items, itemsPage, itemsTotalPages]);

  useEffect(() => {
    setItemsPage(1);
  }, [searchValue, dashboard, accessModeFilter]);

  useEffect(() => {
    setCardsWithoutCodePage(1);
  }, [dashboard, accessModeFilter]);

  useEffect(() => {
    setItemsPage((current) => Math.min(Math.max(current, 1), itemsTotalPages));
  }, [itemsTotalPages]);

  useEffect(() => {
    setCardsWithoutCodePage((current) =>
      Math.min(Math.max(current, 1), cardsWithoutCodeTotalPages),
    );
  }, [cardsWithoutCodeTotalPages]);

  async function handleCopyLink(item: AccessCodeDashboardItem) {
    const actionKey = `copy:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await copyText(buildCardShareLink(item.card.id, item.config.code));
      setFeedback({
        type: "success",
        message: `已复制「${item.card.title}」的提取码链接。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: getShareErrorMessage(error, "复制链接失败，请稍后重试。"),
      });
    } finally {
      setPendingAction("");
    }
  }

  async function handleHide(item: AccessCodeDashboardItem) {
    if (!window.confirm(`确认停用「${item.card.title}」的提取码吗？`)) {
      return;
    }

    const actionKey = `hide:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await shareApi.updateCard(item.card.id, {
        title: item.card.title,
        description: item.card.description,
        visibility: "private",
        status: item.card.status,
        accessMode: item.card.accessMode,
      });
      await loadDashboard();
      setFeedback({
        type: "success",
        message: `已停用「${item.card.title}」的提取码。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: getShareErrorMessage(error, "停用失败，请稍后重试。"),
      });
    } finally {
      setPendingAction("");
    }
  }

  async function handleReactivate(item: AccessCodeDashboardItem) {
    const actionKey = `reactivate:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      if (!item.isPubliclyVisible) {
        await shareApi.updateCard(item.card.id, {
          title: item.card.title,
          description: item.card.description,
          visibility: "public",
          status: "published",
          accessMode: item.card.accessMode,
        });
      }

      if (!item.config.isActive) {
        await shareApi.updateCardAccessCode(item.card.id, {
          code: item.config.code,
          expireDays: item.config.isExpired ? 7 : item.config.expireDays || 7,
          usageLimit: item.config.unlimited
            ? 0
            : Math.max(item.config.usageLimit, 1),
          unlimited: item.config.unlimited,
        });
      }

      await loadDashboard();
      setFeedback({
        type: "success",
        message: `已重新启用「${item.card.title}」的提取码。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: getShareErrorMessage(error, "重新启用失败，请稍后重试。"),
      });
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete(item: AccessCodeDashboardItem) {
    if (
      !window.confirm(`确认删除「${item.card.title}」的提取码吗？删除后不可恢复。`)
    ) {
      return;
    }

    const actionKey = `delete:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await shareApi.deleteCardAccessCode(item.card.id);
      await loadDashboard();
      setFeedback({
        type: "success",
        message: `已删除「${item.card.title}」的提取码。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: getShareErrorMessage(error, "删除失败，请稍后重试。"),
      });
    } finally {
      setPendingAction("");
    }
  }

  function handleCreateCard() {
    setFeedback(null);
    router.push("/creator/new");
  }

  function handleConfigureAccessCode(cardId: string) {
    setFeedback(null);
    router.push(`/creator/cards/${encodeURIComponent(cardId)}/access-code`);
  }

  return {
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
    availableCards,
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
  };
}
