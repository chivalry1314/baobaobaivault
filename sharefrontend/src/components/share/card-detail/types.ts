import type { CardAsset, CardContentSlot, CardDetailResponse } from "@/lib/shared";

export type CardDetailClientPageProps = {
  cardId: string;
};

export type SlotLabelMap = Record<CardContentSlot, string>;

export type CardDetailState = {
  detail: CardDetailResponse | null;
  loading: boolean;
  error: string;
  unlockCode: string;
  downloadPendingSlot: string;
  downloadError: string;
};

export type CardViewModel = {
  creatorName: string;
  creatorHandle: string;
  metric: string;
  tags: string[];
  accessCodeStatus: "none" | "required" | "expired" | "exhausted";
  requiresAccessCode: boolean;
  normalizedUnlockCode: string;
  displayAsset: CardAsset | null;
  cardMimeType: string;
  assetMimeType: string;
  hasCardImage: boolean;
  heroImageUrl: string;
  heroFallbackText: string;
  downloadHint: string;
};
