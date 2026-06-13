import { useEffect, useState } from "react";

import { generateAccessCode } from "@/components/share/card-access-code/helpers";
import { useShareSession } from "@/components/share/session-provider";
import type { UseShareCardAccessCodeArgs } from "@/components/share/card-access-code/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  CardAccessCodeConfig,
  CardDetailResponse,
  ShareCardAccessMode,
} from "@/lib/shared";

export function useShareCardAccessCode({
  cardId,
  isWizardFlow,
}: UseShareCardAccessCodeArgs) {
  const { user: currentUser, sessionChecking } = useShareSession();
  const [loading, setLoading] = useState(() => !!currentUser);
  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [config, setConfig] = useState<CardAccessCodeConfig | null>(null);

  const [accessMode, setAccessMode] = useState<ShareCardAccessMode>("paid");
  const [code, setCode] = useState("");
  const [expireDays, setExpireDays] = useState<number>(7);
  const [unlimited, setUnlimited] = useState(false);
  const [usageLimit, setUsageLimit] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    if (!currentUser?.id) {
      return () => {
        active = false;
      };
    }

    async function loadData() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const [detailResponse, accessCodeResponse] = await Promise.all([
          shareApi.cardDetail(cardId),
          shareApi.cardAccessCode(cardId),
        ]);
        if (!active) {
          return;
        }

        if (!detailResponse.canEdit) {
          setError("你没有这张卡片的编辑权限，无法配置提取码。");
          setDetail(null);
          setConfig(null);
          return;
        }

        const nextConfig = accessCodeResponse.config;
        setDetail(detailResponse);
        setConfig(nextConfig);
        setAccessMode(detailResponse.card.accessMode ?? "free");
        setCode(nextConfig.code || generateAccessCode());
        setExpireDays(nextConfig.code ? nextConfig.expireDays : 7);
        setUnlimited(nextConfig.code ? nextConfig.unlimited : false);
        setUsageLimit(
          nextConfig.code && nextConfig.usageLimit > 0
            ? String(nextConfig.usageLimit)
            : "100",
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          getShareErrorMessage(loadError, "提取码配置加载失败，请稍后重试。"),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [cardId, currentUser?.id]);

  async function handleSubmit() {
    if (!detail) {
      return;
    }

    if (accessMode === "paid") {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) {
        setError("请输入提取码。");
        return;
      }

      if (!unlimited) {
        const numericLimit = Number(usageLimit);
        if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
          setError("使用次数上限必须是大于 0 的数字。");
          return;
        }
      }
    }

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await shareApi.updateCardAccessCode(cardId, {
        accessMode,
        visibility: isWizardFlow ? "public" : detail.card.visibility,
        status: isWizardFlow ? "published" : detail.card.status,
        code: accessMode === "paid" ? code.trim().toUpperCase() : "",
        expireDays: accessMode === "paid" ? expireDays : 0,
        usageLimit:
          accessMode === "paid" ? (unlimited ? 0 : Number(usageLimit)) : 0,
        unlimited: accessMode === "paid" ? unlimited : true,
      });

      const refreshedDetail = await shareApi.cardDetail(cardId);
      setDetail(refreshedDetail);

      const nextConfig = response.config;
      setConfig(nextConfig);
      setCode(nextConfig.code || code);
      setExpireDays(nextConfig.expireDays);
      setUnlimited(nextConfig.unlimited);
      setUsageLimit(
        nextConfig.usageLimit > 0 ? String(nextConfig.usageLimit) : usageLimit,
      );
      setSuccess(
        accessMode === "paid"
          ? "已保存为需提取码模式，提取码已生效。"
          : "已切换为免费卡片，无需提取码。",
      );
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "保存失败，请重试。"));
    } finally {
      setPending(false);
    }
  }

  return {
    sessionChecking,
    loading,
    currentUser,
    detail,
    config,
    accessMode,
    setAccessMode,
    code,
    setCode,
    expireDays,
    setExpireDays,
    unlimited,
    setUnlimited,
    usageLimit,
    setUsageLimit,
    pending,
    error,
    success,
    setCodeRandom: () => setCode(generateAccessCode()),
    handleSubmit,
  };
}
