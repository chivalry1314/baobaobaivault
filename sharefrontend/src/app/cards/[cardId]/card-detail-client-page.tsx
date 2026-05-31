"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardAsset, CardContentSlot, CardDetailResponse } from "@/lib/shared";

const slotLabelMap: Record<CardContentSlot, string> = {
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
};

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

function getCreatorName(detail: CardDetailResponse) {
  return detail.creator.nickname.trim() || detail.creator.username.trim() || "CardShare Creator";
}

function getCreatorHandle(detail: CardDetailResponse) {
  const username = detail.creator.username.trim();
  if (username) {
    return `@${username}`;
  }
  return "@cardshare";
}

function getInitials(name: string) {
  const value = name.trim();
  if (!value) {
    return "CS";
  }
  return Array.from(value).slice(0, 2).join("").toUpperCase();
}

function buildSlotTags(detail: CardDetailResponse) {
  const categories = detail.card.categories ?? [];
  if (categories.length === 0) {
    return ["#卡片", "#分享"];
  }
  return categories.map((slot) => `#${slotLabelMap[slot] ?? slot}`);
}

function pickDisplayAsset(detail: CardDetailResponse): CardAsset | null {
  if (!detail.assets || detail.assets.length === 0) {
    return null;
  }

  for (const asset of detail.assets) {
    if (asset.mimeType.startsWith("image/")) {
      return asset;
    }
  }

  return detail.assets[0] ?? null;
}

type CardDetailClientPageProps = {
  cardId: string;
};

export default function CardDetailClientPage({ cardId }: CardDetailClientPageProps) {
  const searchParams = useSearchParams();
  const codeFromQuery = useMemo(() => searchParams.get("code")?.trim().toUpperCase() ?? "", [searchParams]);

  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlockCode, setUnlockCode] = useState(codeFromQuery);
  const [downloadPendingSlot, setDownloadPendingSlot] = useState<string>("");
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
        setError(loadError instanceof Error ? loadError.message : "卡片详情加载失败");
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

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t-[4px] border-[var(--outline)] bg-white/92 px-5 py-10">
        <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center justify-between gap-5 md:flex-row">
          <div className="text-2xl font-black text-[var(--foreground)]">Dreamy CardShare</div>

          <div className="text-center text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--foreground)]/70 md:text-left">Copyright 2026 CardShare</div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-black text-[var(--foreground)]/78">
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              About
            </Link>
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              Privacy
            </Link>
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    ),
    [],
  );

  const creatorName = detail ? getCreatorName(detail) : "";
  const creatorHandle = detail ? getCreatorHandle(detail) : "";
  const metric = detail ? formatMetric(detail.stats.downloadCount) : "0";
  const tags = detail ? buildSlotTags(detail) : [];
  const accessCodeStatus = detail?.accessCodeStatus ?? "none";
  const requiresAccessCode = Boolean(detail && !detail.canEdit && accessCodeStatus === "required");
  const normalizedUnlockCode = unlockCode.trim().toUpperCase();
  const displayAsset = detail ? pickDisplayAsset(detail) : null;

  const cardMimeType = detail?.card.mimeType.trim().toLowerCase() ?? "";
  const assetMimeType = displayAsset?.mimeType.trim().toLowerCase() ?? "";
  const hasCardImage = Boolean(detail?.card.previewUrl.trim()) && cardMimeType.startsWith("image/");
  const heroImageUrl = hasCardImage ? detail?.card.previewUrl ?? "" : assetMimeType.startsWith("image/") ? displayAsset?.previewUrl ?? "" : "";
  const heroFallbackText = displayAsset?.originalFileName || detail?.card.title || "Card";

  const downloadHint = detail?.canEdit
    ? "你创建的卡片可直接下载分类文件。"
    : requiresAccessCode
      ? "请先输入提取码后再下载分类文件。"
      : accessCodeStatus === "expired"
        ? "当前提取码已过期，暂时无法下载。"
        : accessCodeStatus === "exhausted"
          ? "当前提取码使用次数已达上限，暂时无法下载。"
          : "公开卡片可直接下载各分类文件。";

  async function handleAssetDownload(asset: CardAsset) {
    if (!detail) {
      return;
    }

    if (requiresAccessCode && !normalizedUnlockCode) {
      setDownloadError("请输入提取码后再下载");
      return;
    }

    setDownloadPendingSlot(asset.slot);
    setDownloadError("");

    try {
      const downloadUrl = new URL(asset.downloadUrl, window.location.origin);
      if (requiresAccessCode) {
        downloadUrl.searchParams.set("code", normalizedUnlockCode);
      }

      const response = await fetch(downloadUrl.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        let message = `下载失败 (${response.status})`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          if (typeof payload?.error === "string" && payload.error.trim()) {
            message = payload.error.trim();
          }
        } else {
          const text = await response.text().catch(() => "");
          if (text.trim()) {
            message = text.trim();
          }
        }

        setDownloadError(getShareErrorMessage(new Error(message), "卡片下载失败，请稍后重试。"));
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
      setDownloadError(getShareErrorMessage(downloadReason, "卡片下载失败，请稍后重试。"));
    } finally {
      setDownloadPendingSlot("");
    }
  }

  return (
    <AppShell currentPath="/" footerSlot={footer}>
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="doodle-cloud left-[5%] top-[8%] h-[46px] w-[170px] opacity-50" />
          <div className="doodle-cloud right-[8%] top-[20%] h-[52px] w-[190px] opacity-40" />
          <div className="sparkle-orb left-[-8%] top-[18%] h-[16rem] w-[16rem] bg-[rgba(174,231,217,0.46)]" />
          <div className="sparkle-orb right-[-10%] top-[42%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.34)]" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[var(--layout-max)] px-4 pb-16 pt-10 sm:px-6">
          {loading ? (
            <div className="flex flex-col gap-8 lg:flex-row xl:gap-12">
              <div className="h-[580px] w-full animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70 lg:h-[700px] lg:w-[58%]" />
              <div className="w-full space-y-6 lg:w-[42%]">
                <div className="h-[290px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
                <div className="h-[300px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
                <div className="h-[110px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mx-auto max-w-3xl rounded-3xl border-[4px] border-[var(--outline)] bg-[#ffe6de] px-6 py-5 text-sm font-bold text-[#8a2a14]">{error}</div>
          ) : null}

          {!loading && detail ? (
            <div className="fade-slide-in flex flex-col gap-8 lg:flex-row xl:gap-12">
              <section className="w-full shrink-0 lg:w-[55%] xl:w-[60%]">
                <div className="group relative h-[600px] overflow-hidden rounded-[2rem] border-[4px] border-[var(--outline)] bg-[var(--secondary)] p-3 md:h-[700px]">
                  <Link href="/" className="btn-subtle absolute left-6 top-6 z-20 rounded-full px-4 py-2 font-black">
                    ← 返回
                  </Link>

                  <div className="absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full border-[3px] border-[var(--outline)] bg-white px-4 py-2">
                    <HeartIcon className="h-5 w-5 text-[var(--brand)]" />
                    <span className="text-base font-black text-[var(--foreground)]">{metric}</span>
                  </div>

                  <div className="relative h-full w-full overflow-hidden rounded-[1.3rem] border-[3px] border-[var(--outline)] bg-[var(--outline)]">
                    {heroImageUrl ? (
                      <img src={heroImageUrl} alt={detail.card.title} className="h-full w-full object-cover opacity-86" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--outline)] px-8 text-center text-2xl font-black text-white/90">{heroFallbackText}</div>
                    )}

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                      <h1 className="text-[2.5rem] font-black leading-[1.05] tracking-wide text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:text-5xl md:text-7xl">
                        {detail.card.title}
                      </h1>
                      <p className="mt-3 text-lg font-black text-white/90 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] md:text-2xl">CardShare</p>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="w-full space-y-6 lg:w-[45%] xl:w-[40%]">
                <section className="rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-white p-6 sm:p-7">
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {detail.creator.avatar.trim() ? (
                        <img src={detail.creator.avatar} alt={creatorName} className="h-14 w-14 shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--primary)] object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--outline)] bg-[var(--primary)] text-base font-black text-[var(--foreground)]">
                          {getInitials(creatorName)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-black text-[var(--foreground)]">{creatorName}</h2>
                        <p className="text-sm font-bold text-[var(--foreground)]/70">{creatorHandle}</p>
                      </div>
                    </div>

                    {detail.canEdit ? (
                      <Link href="/creator" className="shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--brand)] px-5 py-1.5 text-sm font-black text-[var(--foreground)]">
                        我的卡片
                      </Link>
                    ) : null}
                  </div>

                  <h3 className="type-h2 text-[var(--foreground)]">卡片描述</h3>
                  <p className="type-body mt-3 font-bold text-[var(--foreground)]/80">{detail.card.description.trim() || "这是一张公开分享卡片，你可以预览内容并按规则下载分类文件。"}</p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className={`inline-flex rounded-full border-[3px] border-[var(--outline)] px-4 py-1.5 text-sm font-black text-[var(--foreground)] ${
                          index % 4 === 0 ? "bg-[var(--secondary)]" : index % 4 === 1 ? "bg-[var(--primary)]" : index % 4 === 2 ? "bg-[var(--tertiary)]" : "bg-[var(--accent)]"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="relative overflow-hidden rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-[var(--tertiary)] p-6 text-center sm:p-7">
                  <h3 className="type-h2 text-[var(--foreground)]">提取分享卡片</h3>
                  <p className="mt-2 text-sm font-bold text-[var(--foreground)]/78">输入提取码后可下载文件，支持系统主题、微信主题、App、角色人设、世界书。</p>

                  <div className="relative mt-6">
                    <input
                      type="text"
                      value={unlockCode}
                      onChange={(event) => {
                        setUnlockCode(event.target.value.toUpperCase());
                        if (downloadError) {
                          setDownloadError("");
                        }
                      }}
                      disabled={!requiresAccessCode}
                      placeholder={requiresAccessCode ? "请输入提取码（示例：SHARE2026）" : "当前卡片无需提取码"}
                      className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-white px-4 py-3 text-base font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:bg-white/70"
                    />
                  </div>

                  {downloadError ? <p className="mt-4 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">{downloadError}</p> : null}

                  <p className="mt-4 text-xs font-bold text-[var(--foreground)]/72">{downloadHint}</p>
                </section>

                <section className="rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-white p-5">
                  <p className="text-sm font-black text-[var(--foreground)]/78">分类文件</p>
                  <div className="mt-3 space-y-3">
                    {detail.assets.map((asset) => {
                      const pending = downloadPendingSlot === asset.slot;
                      const canDownload = detail.canDownload && (!requiresAccessCode || Boolean(normalizedUnlockCode));
                      return (
                        <div key={asset.slot} className="rounded-xl border-[2px] border-[var(--outline)]/30 bg-[#f8f9fa] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[var(--foreground)]">{slotLabelMap[asset.slot]}</p>
                              <p className="truncate text-xs font-bold text-[var(--foreground)]/70">{asset.originalFileName}</p>
                              <p className="text-xs font-bold text-[var(--text-subtle)]">
                                {asset.mimeType} · {formatBytes(asset.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn-primary shrink-0 rounded-full px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={pending || !canDownload}
                              onClick={() => void handleAssetDownload(asset)}
                            >
                              {pending ? "下载中..." : "下载"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </aside>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function HeartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}
