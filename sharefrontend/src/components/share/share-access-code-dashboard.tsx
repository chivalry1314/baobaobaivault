"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { UnifiedFooter } from "@/components/share/unified-footer";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  AccessCodeDashboardItem,
  AccessCodeDashboardResponse,
  PlatformCard,
} from "@/lib/shared";

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "长期有效";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "SSR";
  }
  if (downloadCount >= 30) {
    return "SR";
  }
  return "R";
}

function isExhausted(item: AccessCodeDashboardItem) {
  return (
    !item.config.unlimited &&
    item.config.usageLimit > 0 &&
    item.config.usageCount >= item.config.usageLimit
  );
}

function isActiveItem(item: AccessCodeDashboardItem) {
  return item.isPubliclyVisible && item.config.isActive;
}

function getInactiveReason(item: AccessCodeDashboardItem) {
  if (!item.isPubliclyVisible) {
    return "卡片当前为私密状态，外部用户无法通过提取码访问。";
  }

  if (item.config.isExpired) {
    return "提取码已过期，请重新启用后再分享。";
  }

  if (isExhausted(item)) {
    return "提取码已达到使用次数上限，请调整后再分享。";
  }

  return "提取码当前处于停用状态，可重新启用后继续分享。";
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function buildCardShareLink(cardId: string, code: string) {
  const url = new URL(
    `/cards/${encodeURIComponent(cardId)}`,
    window.location.origin,
  );
  if (code.trim()) {
    url.searchParams.set("code", code.trim());
  }
  return url.toString();
}

export function ShareAccessCodeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [dashboard, setDashboard] =
    useState<AccessCodeDashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [searchValue, setSearchValue] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  async function loadDashboard() {
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const footer = useMemo(() => <UnifiedFooter />, []);

  const items = useMemo(() => {
    const source = dashboard?.items ?? [];
    const keyword = searchValue.trim().toLowerCase();

    const sorted = [...source].sort((left, right) => {
      const activeDiff =
        Number(isActiveItem(right)) - Number(isActiveItem(left));
      if (activeDiff !== 0) {
        return activeDiff;
      }
      return (
        new Date(right.card.updatedAt).getTime() -
        new Date(left.card.updatedAt).getTime()
      );
    });

    if (!keyword) {
      return sorted;
    }

    return sorted.filter((item) =>
      [
        item.card.title,
        item.card.description,
        item.card.originalFileName,
        item.config.code,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [dashboard, searchValue]);

  const availableCards = dashboard?.availableCards ?? [];
  const cardsWithoutCode = useMemo(() => {
    const configuredIds = new Set(
      (dashboard?.items ?? []).map((item) => item.card.id),
    );
    return availableCards.filter((card) => !configuredIds.has(card.id));
  }, [availableCards, dashboard?.items]);
  const totalItems = dashboard?.items.length ?? 0;

  async function handleCopyLink(item: AccessCodeDashboardItem) {
    const actionKey = `copy:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await copyText(buildCardShareLink(item.card.id, item.config.code));
      setFeedback({
        type: "success",
        message: `已复制「${item.card.title}」提取码链接。`,
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
      !window.confirm(
        `确认删除「${item.card.title}」的提取码吗？删除后不可恢复。`,
      )
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

  if (loading && !dashboard && authenticated) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-[1460px] space-y-6">
            <div className="h-28 animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
            <div className="h-[520px] animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return <AuthRedirect nextPath="/creator/access-codes" />;
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-[-9%] top-[8%] h-[22rem] w-[22rem] rounded-full bg-[rgba(207,243,250,0.5)] blur-[96px]" />
          <div className="absolute right-[-8%] bottom-[10%] h-[22rem] w-[22rem] rounded-full bg-[rgba(249,205,205,0.36)] blur-[96px]" />
        </div>

        <section className="relative z-10 mx-auto mt-8 flex w-full max-w-[1460px] flex-col px-5 pb-12 sm:px-8">
          <div className="mb-8 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <Link
                href="/creator"
                className="inline-flex w-fit items-center gap-2 rounded-full border-[3px] border-[var(--line-strong)] bg-white px-6 py-2.5 text-[var(--foreground)] shadow-[2px_2px_0px_var(--line-strong)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                <BackIcon className="h-5 w-5" />
                <span className="font-black">返回</span>
                <SparkleIcon className="h-5 w-5 text-[var(--brand)]" />
              </Link>

              <div>
                <h1 className="text-4xl font-black tracking-tight text-[var(--foreground)] md:text-5xl">
                  提取码管理
                </h1>
                <p className="mt-3 text-lg font-bold text-[var(--foreground)]/70">
                  统一查看、复制、停用与恢复每张卡片的提取码。
                </p>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`mb-6 rounded-[20px] border px-5 py-4 text-sm font-bold ${
                feedback.type === "success"
                  ? "border-[#b8dec8] bg-[#f2fff5] text-[#166534]"
                  : "border-[#f3c8ad] bg-[#fff6ef] text-[#9a3412]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-3xl border-[4px] border-[var(--line-strong)] bg-white p-6 shadow-[6px_6px_0px_var(--line-strong)] md:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full bg-[#cff3fa] opacity-45 blur-3xl" />
              <div className="absolute bottom-[10%] right-[9%] h-40 w-40 rounded-full bg-[#f9cdcd] opacity-35 blur-3xl" />
            </div>

            <div className="relative z-10">
              {!loadError && totalItems > 0 ? (
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <label className="relative block w-full md:max-w-[520px]">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--foreground)]/40" />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="搜索标题、文件名或提取码..."
                      className="dream-input w-full py-3 pl-12 pr-4 font-bold"
                    />
                  </label>

                  <div className="rounded-full border-[3px] border-[var(--line-strong)] bg-[#fcf1a7] px-4 py-2 text-sm font-black text-[var(--foreground)]">
                    共 {totalItems} 条，当前显示 {items.length} 条
                  </div>
                </div>
              ) : null}

              {loadError ? (
                <div className="mb-2 flex flex-col gap-3 rounded-[22px] border border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="rounded-full border border-[#f1b18a] px-4 py-2 text-sm font-bold transition hover:bg-white/80"
                  >
                    重新加载
                  </button>
                </div>
              ) : null}

              {cardsWithoutCode.length > 0 ? (
                <div className="mb-6 rounded-[24px] border-[3px] border-[var(--line-strong)] bg-[#f8fcff] p-5">
                  <div className="mb-4 flex items-center gap-2 text-base font-black text-[var(--foreground)]">
                    <PlusIcon className="h-5 w-5 text-[var(--primary)]" />
                    未配置提取码的卡片
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {cardsWithoutCode.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-[18px] border-[2px] border-[var(--line-strong)] bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-[var(--foreground)]">
                              {card.title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--foreground)]/56">
                              {card.originalFileName || "未命名文件"}
                            </p>
                          </div>
                          <ActionButton
                            onClick={() => handleConfigureAccessCode(card.id)}
                          >
                            <EditIcon className="h-4 w-4" />
                            配置提取码
                          </ActionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!loadError && totalItems === 0 ? (
                <EmptyState
                  cardsWithoutCode={cardsWithoutCode}
                  onConfigureAccessCode={handleConfigureAccessCode}
                  onCreateCard={handleCreateCard}
                />
              ) : null}

              {!loadError && totalItems > 0 && items.length === 0 ? (
                <div className="rounded-[24px] border-[3px] border-[var(--line-strong)] bg-[#f8fcff] px-6 py-12 text-center">
                  <h2 className="text-2xl font-black text-[var(--foreground)]">
                    没有匹配到提取码
                  </h2>
                  <p className="mt-3 text-sm font-bold text-[var(--foreground)]/62">
                    试试更短的关键词，或清空搜索后查看全部提取码。
                  </p>
                </div>
              ) : null}

              {items.length > 0 ? (
                <div className="grid w-full items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {items.map((item) => (
                    <AccessCodeCard
                      key={item.card.id}
                      item={item}
                      pendingAction={pendingAction}
                      onEdit={() => handleConfigureAccessCode(item.card.id)}
                      onCopy={() => void handleCopyLink(item)}
                      onHide={() => void handleHide(item)}
                      onReactivate={() => void handleReactivate(item)}
                      onDelete={() => void handleDelete(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function EmptyState({
  cardsWithoutCode,
  onConfigureAccessCode,
  onCreateCard,
}: {
  cardsWithoutCode: PlatformCard[];
  onConfigureAccessCode: (cardId: string) => void;
  onCreateCard: () => void;
}) {
  const hasAvailableCard = cardsWithoutCode.length > 0;

  return (
    <div className="relative min-h-[480px] overflow-hidden rounded-[30px] border-[3px] border-[var(--line-strong)] bg-[#fcfeff] px-6 py-12 text-center">
      <div className="absolute left-[18%] top-[22%] h-36 w-36 rounded-full bg-[#cff3fa] opacity-60 blur-3xl" />
      <div className="absolute bottom-[18%] right-[18%] h-36 w-36 rounded-full bg-[#f9cdcd] opacity-50 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[var(--line-strong)] bg-[#cff3fa] shadow-[3px_3px_0px_var(--line-strong)]">
          <KeyIcon className="h-8 w-8 text-[var(--primary)]" />
        </div>

        <h2 className="text-3xl font-black text-[var(--foreground)]">
          还没有提取码
        </h2>
        <p className="mt-4 max-w-xl text-lg font-bold text-[var(--foreground)]/70">
          {hasAvailableCard
            ? "你已有可用卡片，直接点击下面按钮即可进入对应卡片的提取码配置页。"
            : "你还没有可配置提取码的卡片，先去创建并发布一张卡片吧。"}
        </p>

        {hasAvailableCard ? (
          <div className="mt-8 flex w-full max-w-2xl flex-col gap-3">
            {cardsWithoutCode.map((card) => (
              <div
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border-[2px] border-[var(--line-strong)] bg-white px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[var(--foreground)]">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--foreground)]/56">
                    {card.originalFileName || "未命名文件"}
                  </p>
                </div>
                <ActionButton onClick={() => onConfigureAccessCode(card.id)}>
                  <EditIcon className="h-4 w-4" />
                  配置提取码
                </ActionButton>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreateCard}
            className="mt-10 rounded-full border-[3px] border-[var(--line-strong)] bg-white px-8 py-3.5 text-lg font-black text-[var(--foreground)] shadow-[3px_3px_0px_var(--line-strong)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_var(--line-strong)]"
          >
            去创建卡片
          </button>
        )}
      </div>
    </div>
  );
}

function AccessCodeCard({
  item,
  pendingAction,
  onEdit,
  onCopy,
  onHide,
  onReactivate,
  onDelete,
}: {
  item: AccessCodeDashboardItem;
  pendingAction: string;
  onEdit: () => void;
  onCopy: () => void;
  onHide: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const active = isActiveItem(item);
  const codeLabel = active ? "当前提取码" : "已停用提取码";
  const statusTip = active
    ? "提取码可正常使用，访问链接可直接分发给用户。"
    : getInactiveReason(item);

  return (
    <article className="h-full w-full rounded-[24px] border-[3px] border-[var(--line-strong)] bg-white p-3 shadow-[3px_3px_0px_var(--line-strong)] sm:p-4">
      <div className="flex h-full flex-col gap-3 lg:flex-row">
        <div className="flex flex-col gap-3">
          <Link
            href={`/cards/${encodeURIComponent(item.card.id)}`}
            className="relative block h-[118px] w-full overflow-hidden rounded-[18px] border-[3px] border-[var(--line-strong)] bg-[#4f4a75] sm:h-[132px] sm:w-[154px] sm:shrink-0"
          >
            {item.card.mimeType.startsWith("image/") ? (
              <img
                src={item.card.previewUrl}
                alt={item.card.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-base font-medium text-white/92">
                {item.card.title}
              </div>
            )}

            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-[rgba(22,12,18,0.74)] px-2.5 py-0.5 text-xs font-semibold text-white">
              <StarMiniIcon className="h-4 w-4 text-[#ffd166]" />
              {getRarityLabel(item.stats.downloadCount)}
            </span>
          </Link>

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/46">
              使用次数
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-black text-[var(--foreground)]/78">
              <DownloadMiniIcon className="h-3.5 w-3.5 text-[var(--brand)]/62" />
              <span>
                {item.config.usageCount}
                {item.config.unlimited
                  ? " / 不限"
                  : ` / ${Math.max(item.config.usageLimit, 0)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-full flex-col gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[1.35rem] font-black leading-none text-[var(--foreground)]">
                {item.card.title}
              </h2>
              <p className="mt-1 text-[11px] font-bold text-[var(--foreground)]/52">
                创建于 {formatDate(item.card.createdAt)}
              </p>
              <div className="my-2 border-t border-dashed border-[var(--line-strong)]/24" />

              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--foreground)]/46">
                  {codeLabel}
                </div>
                <div
                  className={`mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border-[2px] border-[var(--line-strong)] px-3 py-1 text-xs font-black tracking-[0.08em] ${
                    active
                      ? "bg-[#fdeef4] text-[#7d4a5a]"
                      : "bg-[#f6eef1] text-[var(--foreground)]/42"
                  }`}
                >
                  {active ? (
                    <KeyIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <LockIcon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className={`truncate ${active ? "" : "line-through"}`}>
                    {item.config.code}
                  </span>
                </div>

                <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--foreground)]/54">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  到期时间：{formatDateTime(item.config.expiresAt)}
                </div>

                <div className="mt-2">
                  <ActionButton onClick={onEdit}>
                    <EditIcon className="h-4 w-4" />
                    配置提取码
                  </ActionButton>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-2 border-t border-dashed border-[var(--line-strong)]/24 pt-2">
              <span
                className={`rounded-full border-[3px] px-3 py-0.5 text-xs font-black ${
                  active
                    ? "border-[var(--line-strong)] bg-[#eefcf1] text-[#248a42]"
                    : "border-[var(--line-strong)] bg-[#f8eef1] text-[#b18a92]"
                }`}
              >
                {active ? "启用中" : "已停用"}
              </span>

              <p className="w-full text-[11px] font-bold leading-4 text-[var(--foreground)]/58">
                {statusTip}
              </p>
            </div>
            <div className="mt-auto flex w-full flex-wrap items-center gap-1.5">
              {active ? (
                <>
                  <ActionButton
                    disabled={pendingAction === `copy:${item.card.id}`}
                    onClick={onCopy}
                  >
                    <LinkIcon className="h-4 w-4" />
                    {pendingAction === `copy:${item.card.id}`
                      ? "复制中..."
                      : "复制链接"}
                  </ActionButton>
                  <ActionButton
                    danger
                    disabled={pendingAction === `hide:${item.card.id}`}
                    onClick={onHide}
                  >
                    <HideIcon className="h-4 w-4" />
                    {pendingAction === `hide:${item.card.id}`
                      ? "停用中..."
                      : "停用"}
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton
                    disabled={pendingAction === `reactivate:${item.card.id}`}
                    onClick={onReactivate}
                  >
                    <RefreshIcon className="h-4 w-4" />
                    {pendingAction === `reactivate:${item.card.id}`
                      ? "启用中..."
                      : "重新启用"}
                  </ActionButton>
                  <IconActionButton
                    danger
                    disabled={pendingAction === `delete:${item.card.id}`}
                    onClick={onDelete}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </IconActionButton>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border-[3px] px-3 py-1 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-[#f1c5cc] bg-white text-[#cf425d] hover:border-[#cf425d] hover:bg-[#fff7f8]"
          : "border-[var(--line-strong)] bg-white text-[var(--foreground)]/78 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function IconActionButton({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-[3px] transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-[#ead2d8] bg-white text-[#b18a92] hover:border-[#cf425d] hover:text-[#cf425d]"
          : "border-[var(--line-strong)] bg-white text-[var(--foreground)]/78 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-1.5a7.5 7.5 0 1 1-4.72 13.33l-3.3 3.29-1.06-1.06 3.29-3.3A7.5 7.5 0 0 1 10.5 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z"
        fill="currentColor"
      />
    </svg>
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

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M11.25 4.5h1.5v6.75h6.75v1.5h-6.75v6.75h-1.5v-6.75H4.5v-1.5h6.75V4.5Z"
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

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75A4.5 4.5 0 0 0 7.5 8.25V10.5h-.75A2.25 2.25 0 0 0 4.5 12.75v6A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-6a2.25 2.25 0 0 0-2.25-2.25h-.75V8.25A4.5 4.5 0 0 0 12 3.75Zm-3 6.75V8.25a3 3 0 1 1 6 0v2.25H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m16.94 4.94 2.12 2.12-9.3 9.3-3.18 1.06 1.06-3.18 9.3-9.3Zm1.06-1.06a1.5 1.5 0 0 1 2.12 0l.94.94a1.5 1.5 0 0 1 0 2.12l-1 1-3.18-3.18 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LinkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M10.72 13.28a3.75 3.75 0 0 0 5.3 0l2.47-2.47a3.75 3.75 0 1 0-5.3-5.3l-.93.93 1.06 1.06.93-.93a2.25 2.25 0 1 1 3.18 3.18l-2.47 2.47a2.25 2.25 0 0 1-3.18 0l-.53-.53-1.06 1.06.53.53Zm2.56-2.56a3.75 3.75 0 0 0-5.3 0l-2.47 2.47a3.75 3.75 0 0 0 5.3 5.3l.93-.93-1.06-1.06-.93.93a2.25 2.25 0 1 1-3.18-3.18l2.47-2.47a2.25 2.25 0 0 1 3.18 0l.53.53 1.06-1.06-.53-.53Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HideIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 5.25c4.43 0 8.2 2.72 9.75 6.75a10.67 10.67 0 0 1-2.42 3.75l1.48 1.48-1.06 1.06-16-16 1.06-1.06 3.01 3a10.4 10.4 0 0 1 4.18-.88Zm0 1.5c-.99 0-1.94.17-2.82.49l1.35 1.35A3.75 3.75 0 0 1 15.4 13.47l2.83 2.83A9.05 9.05 0 0 0 20.15 12C18.76 8.85 15.68 6.75 12 6.75ZM7.53 8.59 5.77 6.83A8.94 8.94 0 0 0 3.85 12C5.24 15.15 8.32 17.25 12 17.25c1.18 0 2.3-.22 3.34-.63l-1.92-1.92a3.75 3.75 0 0 1-4.83-4.83L7.53 8.59Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RefreshIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 4.5a7.5 7.5 0 0 1 6.84 4.42V6.75h1.5v5.25h-5.25V10.5h2.64A6 6 0 1 0 18 15h1.53A7.5 7.5 0 1 1 12 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9 3.75h6l.75 1.5H19.5v1.5h-15v-1.5h3.75L9 3.75Zm-1.5 6h1.5v7.5H7.5v-7.5Zm4.5 0h1.5v7.5H12v-7.5Zm4.5 0H18v7.5h-1.5v-7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M11.25 4.5h1.5v8.19l2.97-2.97 1.06 1.06L12 15.56l-4.78-4.78 1.06-1.06 2.97 2.97V4.5ZM5.25 17.25h13.5v1.5H5.25v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StarMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3 2.08 4.22 4.66.68-3.37 3.28.8 4.64L12 13.4l-4.17 2.42.8-4.64L5.26 7.9l4.66-.68L12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 3.75h1.5v1.5h6v-1.5h1.5v1.5h1.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 20.25H6a2.25 2.25 0 0 1-2.25-2.25V7.5A2.25 2.25 0 0 1 6 5.25h1.5v-1.5ZM6 9.75v8.25c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75V9.75H6Z"
        fill="currentColor"
      />
    </svg>
  );
}
