import { useCallback, useEffect, useMemo, useState } from "react";

import { useShareSession } from "@/components/share/session-provider";
import {
  REVIEW_PAGE_SIZE,
  type ReviewFilter,
} from "@/components/share/review-dashboard/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ReviewDashboardItem } from "@/lib/shared";

export function useShareReviewDashboard() {
  const { user: currentUser, sessionChecking } = useShareSession();
  const [loading, setLoading] = useState(() => !!(currentUser && currentUser.role === "manager"));
  const [items, setItems] = useState<ReviewDashboardItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewFilter>("");
  const [pendingCardId, setPendingCardId] = useState("");
  const [page, setPage] = useState(1);

  const loadReviews = useCallback(async (nextFilter: ReviewFilter) => {
    setLoading(true);
    setLoadError("");

    try {
      const payload = await shareApi.adminReviews(nextFilter || undefined);
      setItems(payload.items);
      setPage(1);
    } catch (error) {
      setLoadError(
        getShareErrorMessage(error, "加载审核列表失败，请稍后重试。"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "manager") {
      void loadReviews(statusFilter);
    }
  }, [currentUser?.id, currentUser?.role, loadReviews, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / REVIEW_PAGE_SIZE)),
    [items.length],
  );

  const pagedItems = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * REVIEW_PAGE_SIZE;
    return items.slice(start, start + REVIEW_PAGE_SIZE);
  }, [items, page, totalPages]);

  async function handleApprove(cardId: string) {
    setPendingCardId(cardId);
    setActionError("");

    try {
      await shareApi.adminApproveReview(cardId);
      await loadReviews(statusFilter);
    } catch (error) {
      setActionError(
        getShareErrorMessage(error, "审核通过失败，请稍后重试。"),
      );
    } finally {
      setPendingCardId("");
    }
  }

  async function handleReject(cardId: string) {
    const reason = window.prompt("请输入驳回原因（必填）：", "");
    if (reason === null) {
      return;
    }
    if (!reason.trim()) {
      setActionError("驳回原因不能为空。");
      return;
    }

    setPendingCardId(cardId);
    setActionError("");

    try {
      await shareApi.adminRejectReview(cardId, reason.trim());
      await loadReviews(statusFilter);
    } catch (error) {
      setActionError(getShareErrorMessage(error, "驳回失败，请稍后重试。"));
    } finally {
      setPendingCardId("");
    }
  }

  function handleFilter(nextFilter: ReviewFilter) {
    setStatusFilter(nextFilter);
  }

  return {
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
  };
}
