import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildSelectableCardIds,
  buildSelectableCards,
  pickSelectedCardId,
} from "@/components/share/access-code-card-picker/helpers";
import type {
  ViewMode,
  VisibilityFilter,
} from "@/components/share/access-code-card-picker/types";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { DashboardCard } from "@/lib/shared";

export function useShareAccessCodeCardPicker() {
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
        const [accessCodePayload, cardsPayload] = await Promise.all([
          shareApi.myAccessCodes(),
          shareApi.myCards(),
        ]);
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

  const effectiveSelectedCardId = useMemo(
    () => pickSelectedCardId(filteredCards, selectedCardId),
    [filteredCards, selectedCardId],
  );

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

  return {
    loading,
    authenticated,
    cards,
    selectedCardId,
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
  };
}
