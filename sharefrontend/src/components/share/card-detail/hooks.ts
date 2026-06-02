import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { buildCardViewModel } from "@/components/share/card-detail/helpers";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardAsset, CardDetailResponse } from "@/lib/shared";

type UseCardDetailArgs = {
  cardId: string;
};

export function useCardDetail({ cardId }: UseCardDetailArgs) {
  const searchParams = useSearchParams();
  const codeFromQuery = useMemo(
    () => searchParams.get("code")?.trim().toUpperCase() ?? "",
    [searchParams],
  );

  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlockCode, setUnlockCode] = useState(codeFromQuery);
  const [downloadPendingSlot, setDownloadPendingSlot] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    setUnlockCode(codeFromQuery);
  }, [codeFromQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setDownloadError("");

      try {
        const payload = await shareApi.cardDetail(cardId);
        if (!active) {
          return;
        }
        setDetail(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          getShareErrorMessage(loadError, "卡片详情加载失败，请稍后重试。"),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [cardId]);

  const viewModel = useMemo(
    () => buildCardViewModel(detail, unlockCode),
    [detail, unlockCode],
  );

  async function handleAssetDownload(asset: CardAsset) {
    if (!detail) {
      return;
    }

    if (viewModel.requiresAccessCode && !viewModel.normalizedUnlockCode) {
      setDownloadError("请输入提取码后再下载");
      return;
    }

    setDownloadPendingSlot(asset.slot);
    setDownloadError("");

    try {
      const downloadUrl = new URL(asset.downloadUrl, window.location.origin);
      if (viewModel.requiresAccessCode) {
        downloadUrl.searchParams.set("code", viewModel.normalizedUnlockCode);
      }

      const response = await fetch(downloadUrl.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        let message = `下载失败 (${response.status})`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          if (typeof payload?.error === "string" && payload.error.trim()) {
            message = payload.error.trim();
          }
        } else {
          const text = await response.text().catch(() => "");
          if (text.trim()) {
            message = text.trim();
          }
        }

        setDownloadError(
          getShareErrorMessage(new Error(message), "卡片下载失败，请稍后重试。"),
        );
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = asset.originalFileName || "card-asset-download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (downloadReason) {
      setDownloadError(
        getShareErrorMessage(downloadReason, "卡片下载失败，请稍后重试。"),
      );
    } finally {
      setDownloadPendingSlot("");
    }
  }

  return {
    detail,
    loading,
    error,
    unlockCode,
    setUnlockCode,
    downloadPendingSlot,
    downloadError,
    setDownloadError,
    viewModel,
    handleAssetDownload,
  };
}
