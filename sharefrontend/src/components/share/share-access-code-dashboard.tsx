"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthCard } from "@/components/share/auth-card";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { AccessCodeDashboardItem, AccessCodeDashboardResponse, PlatformCard } from "@/lib/shared";

type FeedbackState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

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
  return !item.config.unlimited && item.config.usageLimit > 0 && item.config.usageCount >= item.config.usageLimit;
}

function isActiveItem(item: AccessCodeDashboardItem) {
  return item.isPubliclyVisible && item.config.isActive;
}

function getInactiveReason(item: AccessCodeDashboardItem) {
  if (!item.isPubliclyVisible) {
    return "当前卡片已下架，分享链接暂不可访问。";
  }
  if (item.config.isExpired) {
    return "当前提取码已过期，重新激活后可继续分享。";
  }
  if (isExhausted(item)) {
    return "当前提取码使用次数已达上限，重新激活后会重置次数。";
  }
  return "当前提取码暂不可用。";
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
  const url = new URL(`/cards/${encodeURIComponent(cardId)}`, window.location.origin);
  if (code.trim()) {
    url.searchParams.set("code", code.trim());
  }
  return url.toString();
}

export function ShareAccessCodeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [dashboard, setDashboard] = useState<AccessCodeDashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [searchValue, setSearchValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
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
        setLoadError(getShareErrorMessage(error, "提取码管理加载失败，请稍后重试。"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const headerSlot = useMemo(
    () => (
      <>
        <label className="hidden min-w-[320px] items-center gap-3 rounded-full border border-[rgba(226,204,210,0.9)] bg-white/92 px-4 py-2.5 shadow-[0_16px_36px_-30px_rgba(120,85,94,0.35)] md:flex">
          <SearchIcon className="h-5 w-5 text-[var(--foreground)]/38" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="搜索卡片或提取码..."
            className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/35"
          />
        </label>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(231,212,216,0.85)] bg-white/88 text-[var(--brand-strong)] shadow-[0_16px_36px_-28px_rgba(120,85,94,0.28)] transition hover:-translate-y-0.5"
        >
          <BellIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(231,212,216,0.85)] bg-white/88 text-[#e85b8c] shadow-[0_16px_36px_-28px_rgba(120,85,94,0.28)] transition hover:-translate-y-0.5"
        >
          <HeartIcon className="h-5 w-5" />
        </button>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(231,212,216,0.85)] bg-white/88 text-[var(--brand)] shadow-[0_16px_36px_-28px_rgba(120,85,94,0.28)]">
          <SparkleIcon className="h-5 w-5" />
        </span>
      </>
    ),
    [searchValue],
  );

  const footer = useMemo(
    () => (
      <footer className="relative z-10 px-6 pb-10 pt-16 text-center text-sm tracking-[0.08em] text-[var(--brand)]/55">
        © 2024 CardShare · 为每一份心意赋予分享价值
      </footer>
    ),
    [],
  );

  const items = useMemo(() => {
    const source = dashboard?.items ?? [];
    const keyword = searchValue.trim().toLowerCase();

    const sorted = [...source].sort((left, right) => {
      const activeDiff = Number(isActiveItem(right)) - Number(isActiveItem(left));
      if (activeDiff !== 0) {
        return activeDiff;
      }

      return new Date(right.card.updatedAt).getTime() - new Date(left.card.updatedAt).getTime();
    });

    if (!keyword) {
      return sorted;
    }

    return sorted.filter((item) =>
      [item.card.title, item.card.description, item.card.originalFileName, item.config.code]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [dashboard, searchValue]);

  const availableCards = dashboard?.availableCards ?? [];
  const totalItems = dashboard?.items.length ?? 0;

  async function handleCopyLink(item: AccessCodeDashboardItem) {
    const actionKey = `copy:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await copyText(buildCardShareLink(item.card.id, item.config.code));
      setFeedback({ type: "success", message: `已复制《${item.card.title}》的提取链接。` });
    } catch (error) {
      setFeedback({ type: "error", message: getShareErrorMessage(error, "复制链接失败，请稍后重试。") });
    } finally {
      setPendingAction("");
    }
  }

  async function handleHide(item: AccessCodeDashboardItem) {
    if (!window.confirm(`确认下架《${item.card.title}》吗？下架后公开链接将暂时不可访问。`)) {
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
      setFeedback({ type: "success", message: `《${item.card.title}》已下架。` });
    } catch (error) {
      setFeedback({ type: "error", message: getShareErrorMessage(error, "下架失败，请稍后重试。") });
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
          usageLimit: item.config.unlimited ? 0 : Math.max(item.config.usageLimit, 1),
          unlimited: item.config.unlimited,
        });
      }

      await loadDashboard();
      setFeedback({ type: "success", message: `《${item.card.title}》已重新激活。` });
    } catch (error) {
      setFeedback({ type: "error", message: getShareErrorMessage(error, "重新激活失败，请稍后重试。") });
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete(item: AccessCodeDashboardItem) {
    if (!window.confirm(`确认删除《${item.card.title}》的提取码记录吗？删除后需要重新生成提取码。`)) {
      return;
    }

    const actionKey = `delete:${item.card.id}`;
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await shareApi.deleteCardAccessCode(item.card.id);
      await loadDashboard();
      setFeedback({ type: "success", message: `《${item.card.title}》的提取码记录已删除。` });
    } catch (error) {
      setFeedback({ type: "error", message: getShareErrorMessage(error, "删除提取码失败，请稍后重试。") });
    } finally {
      setPendingAction("");
    }
  }

  function handleCreateNewAccessCode() {
    setFeedback(null);
    router.push("/creator/access-codes/new");
  }

  function handlePickCard(card: PlatformCard) {
    setPickerOpen(false);
    router.push(`/creator/cards/${encodeURIComponent(card.id)}/access-code`);
  }

  if (loading && !dashboard && authenticated) {
    return (
      <AppShell currentPath="/creator" headerSlot={headerSlot} footerSlot={footer}>
        <div className="px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-[1480px] space-y-6">
            <div className="h-32 animate-pulse rounded-[40px] border border-white/80 bg-white/70" />
            <div className="grid gap-8 xl:grid-cols-2">
              <div className="h-[320px] animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
              <div className="h-[320px] animate-pulse rounded-[36px] border border-white/80 bg-white/70" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <AuthCard afterSuccess="/creator/access-codes" />
      </div>
    );
  }

  return (
    <AppShell currentPath="/creator" headerSlot={headerSlot} footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fff9f9_0%,#fffdfb_45%,#fff5f7_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[6%] h-[26rem] w-[26rem] rounded-full bg-[rgba(255,212,223,0.36)] blur-[120px]" />
          <div className="absolute right-[-8%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-[rgba(249,216,246,0.28)] blur-[120px]" />
          <div className="absolute bottom-[-14%] left-[12%] h-[28rem] w-[28rem] rounded-full bg-[rgba(255,226,231,0.32)] blur-[120px]" />
          <div className="absolute bottom-[6%] right-[4%] h-16 w-16 text-[rgba(236,171,198,0.5)]">
            <SparkleIcon />
          </div>
        </div>

        <section className="relative z-10 mx-auto max-w-[1480px] px-4 pb-16 pt-10 sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/creator"
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(226,204,210,0.9)] bg-white/88 px-4 py-2 text-sm text-[var(--foreground)]/72 shadow-[0_16px_36px_-30px_rgba(120,85,94,0.22)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <BackIcon className="h-4.5 w-4.5" />
                <span>返回</span>
              </Link>
              <div className="inline-flex items-center gap-3 text-[rgba(236,171,198,0.9)]">
                <SparkleIcon className="h-7 w-7" />
              </div>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[3.75rem]">提取码管理</h1>
              <p className="mt-4 text-xl text-[var(--foreground)]/68">管理和分享您的梦幻卡片合集</p>
            </div>

            <button
              type="button"
              onClick={handleCreateNewAccessCode}
              className="inline-flex items-center justify-center gap-3 self-start rounded-full bg-[linear-gradient(135deg,#ffb5c4_0%,#ff9ab0_100%)] px-8 py-5 text-xl font-semibold text-white shadow-[0_24px_48px_-30px_rgba(255,110,146,0.68)] transition hover:-translate-y-0.5"
            >
              <PlusIcon className="h-6 w-6" />
              <span>生成新提取码</span>
            </button>
          </div>

          {feedback ? (
            <div
              className={`mt-8 rounded-[26px] border px-5 py-4 text-sm shadow-[0_20px_40px_-34px_rgba(120,85,94,0.28)] ${
                feedback.type === "success"
                  ? "border-[#b8dec8] bg-[#f2fff5] text-[#166534]"
                  : "border-[#f3c8ad] bg-[#fff6ef] text-[#9a3412]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          {loadError ? (
            <div className="mt-8 flex flex-col gap-3 rounded-[28px] border border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] shadow-[0_20px_40px_-34px_rgba(154,52,18,0.35)] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="w-fit rounded-full border border-[#f1b18a] px-4 py-2 text-sm transition hover:bg-white/80"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {!loadError && totalItems === 0 ? (
            <section className="mt-10 rounded-[36px] border border-white/80 bg-white/84 px-6 py-14 text-center shadow-[0_30px_70px_-46px_rgba(120,85,94,0.28)] sm:px-10">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,223,231,0.9)] text-[var(--brand-strong)]">
                <KeyIcon className="h-10 w-10" />
              </div>
              <h2 className="mt-6 text-3xl font-semibold text-[var(--foreground)]">还没有提取码记录</h2>
              <p className="mt-4 text-lg text-[var(--foreground)]/62">
                {availableCards.length > 0 ? "先为一张卡片生成提取码，即可在这里统一管理分享状态。" : "当前还没有可生成提取码的卡片，请先去创作中心发布卡片。"}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {availableCards.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleCreateNewAccessCode}
                    className="rounded-full bg-[linear-gradient(135deg,#ffb5c4_0%,#ff9ab0_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(255,110,146,0.68)] transition hover:-translate-y-0.5"
                  >
                    立即生成提取码
                  </button>
                ) : null}
                <Link
                  href="/creator"
                  className="rounded-full border border-[rgba(226,204,210,0.9)] bg-white px-6 py-3 text-base text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  返回我的卡片
                </Link>
              </div>
            </section>
          ) : null}

          {!loadError && totalItems > 0 && items.length === 0 ? (
            <section className="mt-10 rounded-[32px] border border-white/80 bg-white/84 px-6 py-12 text-center shadow-[0_30px_70px_-46px_rgba(120,85,94,0.22)]">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">没有匹配的提取码记录</h2>
              <p className="mt-3 text-base text-[var(--foreground)]/58">换个关键词试试，或者清空搜索后查看全部提取码。</p>
            </section>
          ) : null}

          {items.length > 0 ? (
            <div className="mt-10 grid gap-8 xl:grid-cols-2">
              {items.map((item) => (
                <AccessCodeCard
                  key={item.card.id}
                  item={item}
                  pendingAction={pendingAction}
                  onEdit={() => router.push(`/creator/cards/${encodeURIComponent(item.card.id)}/access-code`)}
                  onCopy={() => void handleCopyLink(item)}
                  onHide={() => void handleHide(item)}
                  onReactivate={() => void handleReactivate(item)}
                  onDelete={() => void handleDelete(item)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-[rgba(64,40,49,0.32)] backdrop-blur-[2px]"
            onClick={() => setPickerOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-[34px] border border-white/80 bg-white/96 p-6 shadow-[0_32px_80px_-38px_rgba(120,85,94,0.48)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold text-[var(--foreground)]">选择要生成提取码的卡片</h2>
                <p className="mt-2 text-sm text-[var(--foreground)]/58">从未设置提取码的卡片中选择一张，进入配置页继续设置。</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(231,212,216,0.85)] bg-white text-[var(--foreground)]/58 transition hover:text-[var(--primary)]"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {availableCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handlePickCard(card)}
                  className="flex w-full items-center gap-4 rounded-[26px] border border-[rgba(237,221,225,0.92)] bg-[rgba(255,248,249,0.94)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[rgba(231,167,188,0.9)] hover:bg-white"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#2a1a21_0%,#72545c_100%)]">
                    {card.mimeType.startsWith("image/") ? (
                      <img src={card.previewUrl} alt={card.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-white/92">{card.title}</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-semibold text-[var(--foreground)]">{card.title}</div>
                    <div className="mt-2 text-sm text-[var(--foreground)]/54">创建于 {formatDate(card.createdAt)}</div>
                    <div className="mt-2 inline-flex rounded-full bg-[rgba(255,229,236,0.92)] px-3 py-1 text-xs text-[var(--brand-strong)]">
                      {card.visibility === "public" ? "公开卡片" : "私密卡片"}
                    </div>
                  </div>

                  <span className="rounded-full border border-[rgba(231,167,188,0.9)] px-4 py-2 text-sm text-[var(--brand-strong)]">立即设置</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
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
  const codeLabel = active ? "当前提取码" : "历史提取码";
  const actionPrefix = active ? "当前链接可正常分享。" : getInactiveReason(item);

  return (
    <article className="overflow-hidden rounded-[38px] border border-white/80 bg-white/86 p-5 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.3)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row">
        <Link
          href={`/cards/${encodeURIComponent(item.card.id)}`}
          className="relative block h-[160px] w-full overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2a1a21_0%,#72545c_100%)] lg:w-[190px] lg:shrink-0"
        >
          {item.card.mimeType.startsWith("image/") ? (
            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-base font-medium text-white/92">{item.card.title}</div>
          )}

          <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-[rgba(22,12,18,0.74)] px-3 py-1 text-sm font-semibold text-white">
            <StarMiniIcon className="h-4 w-4 text-[#ffd166]" />
            {getRarityLabel(item.stats.downloadCount)}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[2.25rem] font-semibold leading-none text-[var(--foreground)]">{item.card.title}</h2>
              <p className="mt-4 text-lg text-[var(--foreground)]/48">创建于 {formatDate(item.card.createdAt)}</p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold ${
                active
                  ? "border border-[#b9e3c1] bg-[#eefcf1] text-[#248a42]"
                  : "border border-[#ead2d8] bg-[#f8eef1] text-[#b18a92]"
              }`}
            >
              {active ? "有效" : "已失效"}
            </span>
          </div>

          <div className="mt-6 border-t border-dashed border-[rgba(236,205,214,0.9)]" />

          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <div className="text-sm text-[var(--foreground)]/48">{codeLabel}</div>
              <div
                className={`mt-3 inline-flex max-w-full items-center gap-3 rounded-full px-5 py-3 text-[1.1rem] tracking-[0.12em] ${
                  active ? "bg-[rgba(250,219,227,0.92)] text-[#7d4a5a]" : "bg-[rgba(246,238,240,0.96)] text-[var(--foreground)]/42"
                }`}
              >
                {active ? <KeyIcon className="h-5 w-5 shrink-0" /> : <LockIcon className="h-5 w-5 shrink-0" />}
                <span className={`truncate ${active ? "" : "line-through"}`}>{item.config.code}</span>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-sm text-[var(--foreground)]/48">提取次数</div>
              <div className="mt-3 inline-flex items-center gap-2 text-[1.1rem] font-semibold text-[var(--foreground)]/72 sm:justify-end">
                <DownloadMiniIcon className="h-5 w-5 text-[var(--brand)]/55" />
                <span>{item.config.usageCount} 次</span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm text-[var(--foreground)]/52">{actionPrefix}</p>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {active ? (
              <>
                <ActionButton disabled={pendingAction === `edit:${item.card.id}`} onClick={onEdit}>
                  <EditIcon className="h-4.5 w-4.5" />
                  <span>修改码</span>
                </ActionButton>
                <ActionButton disabled={pendingAction === `copy:${item.card.id}`} onClick={onCopy}>
                  <LinkIcon className="h-4.5 w-4.5" />
                  <span>{pendingAction === `copy:${item.card.id}` ? "复制中..." : "复制链接"}</span>
                </ActionButton>
                <ActionButton danger disabled={pendingAction === `hide:${item.card.id}`} onClick={onHide}>
                  <HideIcon className="h-4.5 w-4.5" />
                  <span>{pendingAction === `hide:${item.card.id}` ? "处理中..." : "下架"}</span>
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton disabled={pendingAction === `reactivate:${item.card.id}`} onClick={onReactivate}>
                  <RefreshIcon className="h-4.5 w-4.5" />
                  <span>{pendingAction === `reactivate:${item.card.id}` ? "激活中..." : "重新激活"}</span>
                </ActionButton>
                <IconActionButton danger disabled={pendingAction === `delete:${item.card.id}`} onClick={onDelete}>
                  <TrashIcon className="h-4.5 w-4.5" />
                </IconActionButton>
              </>
            )}
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
      className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-base transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-[#f1c5cc] bg-white text-[#cf425d] hover:border-[#cf425d] hover:bg-[#fff7f8]"
          : "border-[rgba(226,204,210,0.92)] bg-white text-[var(--foreground)]/78 hover:border-[var(--primary)] hover:text-[var(--primary)]"
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
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-[#ead2d8] bg-white text-[#b18a92] hover:border-[#cf425d] hover:text-[#cf425d]"
          : "border-[rgba(226,204,210,0.92)] bg-white text-[var(--foreground)]/78 hover:border-[var(--primary)] hover:text-[var(--primary)]"
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
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}

function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75a4.5 4.5 0 0 0-4.5 4.5v2.41c0 .83-.27 1.64-.78 2.29l-1.1 1.39A1.5 1.5 0 0 0 6.8 16.5h10.4a1.5 1.5 0 0 0 1.18-2.36l-1.1-1.39a3.74 3.74 0 0 1-.78-2.29V8.25A4.5 4.5 0 0 0 12 3.75Zm0 16.5a2.63 2.63 0 0 1-2.47-1.75h4.94A2.63 2.63 0 0 1 12 20.25Z"
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
      <path d="M11.25 4.5h1.5v6.75h6.75v1.5h-6.75v6.75h-1.5v-6.75H4.5v-1.5h6.75V4.5Z" fill="currentColor" />
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
      <path d="M11.25 4.5h1.5v8.19l2.97-2.97 1.06 1.06L12 15.56l-4.78-4.78 1.06-1.06 2.97 2.97V4.5ZM5.25 17.25h13.5v1.5H5.25v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function StarMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m12 3 2.08 4.22 4.66.68-3.37 3.28.8 4.64L12 13.4l-4.17 2.42.8-4.64L5.26 7.9l4.66-.68L12 3Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m6.53 5.47 5.47 5.47 5.47-5.47 1.06 1.06L13.06 12l5.47 5.47-1.06 1.06L12 13.06l-5.47 5.47-1.06-1.06L10.94 12 5.47 6.53l1.06-1.06Z" fill="currentColor" />
    </svg>
  );
}
