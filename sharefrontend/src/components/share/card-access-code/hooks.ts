import { useEffect, useState } from "react";

import {
  generateAccessCode,
} from "@/components/share/card-access-code/helpers";
import type { UseShareCardAccessCodeArgs } from "@/components/share/card-access-code/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  CardAccessCodeConfig,
  CardDetailResponse,
  ExternalSessionUser,
} from "@/lib/shared";

export function useShareCardAccessCode({
  cardId,
  isWizardFlow,
}: UseShareCardAccessCodeArgs) {
  const [sessionChecking, setSessionChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [config, setConfig] = useState<CardAccessCodeConfig | null>(null);

  const [code, setCode] = useState("");
  const [expireDays, setExpireDays] = useState<number>(7);
  const [unlimited, setUnlimited] = useState(false);
  const [usageLimit, setUsageLimit] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          return;
        }

        setCurrentUser(session.user);
      } catch {
        if (active) {
          setCurrentUser(null);
        }
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
  }, []);

  useEffect(() => {
    let active = true;

    if (!currentUser) {
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
          setError("你没有该卡片的编辑权限，无法配置提取码。");
          setDetail(null);
          setConfig(null);
          return;
        }

        const nextConfig = accessCodeResponse.config;
        setDetail(detailResponse);
        setConfig(nextConfig);
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
  }, [cardId, currentUser]);

  async function handleSubmit() {
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

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await shareApi.updateCardAccessCode(cardId, {
        code: normalizedCode,
        expireDays,
        usageLimit: unlimited ? 0 : Number(usageLimit),
        unlimited,
      });

      if (
        isWizardFlow &&
        detail &&
        (detail.card.visibility !== "public" || detail.card.status !== "published")
      ) {
        const updateCardResponse = await shareApi.updateCard(cardId, {
          title: detail.card.title,
          description: detail.card.description,
          visibility: "public",
          status: "published",
        });

        setDetail((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            card: updateCardResponse.card,
          };
        });
      }

      const nextConfig = response.config;
      setConfig(nextConfig);
      setCode(nextConfig.code);
      setExpireDays(nextConfig.expireDays);
      setUnlimited(nextConfig.unlimited);
      setUsageLimit(
        nextConfig.usageLimit > 0 ? String(nextConfig.usageLimit) : usageLimit,
      );
      setSuccess("提取码已保存。");
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "保存提取码失败，请重试。"));
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
