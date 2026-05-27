"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";

import { AppShell } from "@/components/share/app-shell";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardDetailResponse } from "@/lib/shared";

const demoCardDetails: Record<string, CardDetailResponse> = {
  "demo-sakura": {
    card: {
      id: "demo-sakura",
      creatorId: "demo-creator-sakura",
      title: "樱花树下的约定",
      description:
        "在春天的最后一个傍晚，樱花如雪飘落。这张卡片收藏了一次温柔告白的瞬间，适合分享、收藏，也适合作为纪念原图长期保存。",
      visibility: "public",
      status: "published",
      originalFileName: "sakura-promise.png",
      mimeType: "image/png",
      size: 45.2 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-sakura&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-sakura&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    },
    creator: {
      id: "demo-creator-sakura",
      username: "sakuradreams",
      nickname: "SakuraSensei",
      avatar: "/api/demo-media?id=avatar-sakura&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 1200,
      lastDownloadedAt: "2026-04-24T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
  "demo-sunset": {
    card: {
      id: "demo-sunset",
      creatorId: "demo-creator-sunset",
      title: "暮色海岸",
      description:
        "日落把海平面染成了柔软的橙粉色，整张图以低饱和氛围光为主，适合做封面、头像背景和浪漫分享卡片。",
      visibility: "public",
      status: "published",
      originalFileName: "sunset-coast.jpg",
      mimeType: "image/jpeg",
      size: 22.8 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-sunset&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-sunset&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-02T00:00:00Z",
      updatedAt: "2026-04-02T00:00:00Z",
    },
    creator: {
      id: "demo-creator-sunset",
      username: "mikanstudio",
      nickname: "Mikan Studio",
      avatar: "/api/demo-media?id=avatar-sunset&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 856,
      lastDownloadedAt: "2026-04-22T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
  "demo-rose": {
    card: {
      id: "demo-rose",
      creatorId: "demo-creator-rose",
      title: "玫瑰信笺",
      description:
        "用花束、纸张和微距虚化做成的情绪卡片，适合表达想念、告白和纪念日文案，整体氛围更偏复古与温柔。",
      visibility: "public",
      status: "published",
      originalFileName: "rose-letter.jpg",
      mimeType: "image/jpeg",
      size: 18.4 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-rose&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-rose&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-03T00:00:00Z",
      updatedAt: "2026-04-03T00:00:00Z",
    },
    creator: {
      id: "demo-creator-rose",
      username: "shirodraws",
      nickname: "Shiro Draws",
      avatar: "/api/demo-media?id=avatar-rose&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 2100,
      lastDownloadedAt: "2026-04-23T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
  "demo-crystal": {
    card: {
      id: "demo-crystal",
      creatorId: "demo-creator-crystal",
      title: "水晶心愿",
      description:
        "以透明质感和柔雾高光作为主视觉，适合做梦幻系卡片封面或祝福场景，用来表达温柔心事很合适。",
      visibility: "public",
      status: "published",
      originalFileName: "crystal-wish.jpg",
      mimeType: "image/jpeg",
      size: 16.9 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-crystal&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-crystal&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-04T00:00:00Z",
      updatedAt: "2026-04-04T00:00:00Z",
    },
    creator: {
      id: "demo-creator-crystal",
      username: "yuka_art",
      nickname: "Yuka Art",
      avatar: "/api/demo-media?id=avatar-crystal&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 542,
      lastDownloadedAt: "2026-04-21T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
  "demo-moon": {
    card: {
      id: "demo-moon",
      creatorId: "demo-creator-moon",
      title: "月光旅程",
      description:
        "这是一张偏夜景叙事的氛围卡片，适合作为旅行纪念封面或城市故事分享图，整体更安静也更留白。",
      visibility: "public",
      status: "published",
      originalFileName: "moon-journey.jpg",
      mimeType: "image/jpeg",
      size: 24.6 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-moon&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-moon&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-05T00:00:00Z",
      updatedAt: "2026-04-05T00:00:00Z",
    },
    creator: {
      id: "demo-creator-moon",
      username: "nightsky",
      nickname: "Night Sky",
      avatar: "/api/demo-media?id=avatar-moon&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 980,
      lastDownloadedAt: "2026-04-20T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
  "demo-flower": {
    card: {
      id: "demo-flower",
      creatorId: "demo-creator-flower",
      title: "花信风",
      description:
        "轻盈的花束与柔焦背景组合成了更适合社交分享的卡面，适合春日祝福、收藏或制作个人卡片模板。",
      visibility: "public",
      status: "published",
      originalFileName: "flower-bloom.jpg",
      mimeType: "image/jpeg",
      size: 19.3 * 1024 * 1024,
      previewUrl: "/api/demo-media?id=demo-flower&w=1400&h=1800&kind=card",
      downloadUrl: "/api/demo-media?id=demo-flower&w=1800&h=2400&kind=card&download=1",
      createdAt: "2026-04-06T00:00:00Z",
      updatedAt: "2026-04-06T00:00:00Z",
    },
    creator: {
      id: "demo-creator-flower",
      username: "florafan",
      nickname: "Flora Fan",
      avatar: "/api/demo-media?id=avatar-flower&w=240&h=240&kind=avatar",
    },
    stats: {
      downloadCount: 731,
      lastDownloadedAt: "2026-04-19T00:00:00Z",
    },
    canEdit: false,
    canDownload: true,
  },
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

function getFileKindLabel(detail: CardDetailResponse) {
  const extension = detail.card.originalFileName.split(".").pop()?.trim().toUpperCase();
  if (extension) {
    return `${extension} 原图`;
  }

  if (detail.card.mimeType.startsWith("image/")) {
    return "图片原图";
  }

  return "附件文件";
}

function buildTags(detail: CardDetailResponse) {
  const source = `${detail.card.title} ${detail.card.description} ${detail.card.originalFileName}`.toLowerCase();
  const tags: string[] = [];

  if (source.includes("anime") || source.includes("illustration") || source.includes("sakura") || source.includes("樱")) {
    tags.push("#二次元");
  }
  if (source.includes("love") || source.includes("romance") || source.includes("约定") || source.includes("恋")) {
    tags.push("#恋爱");
  }
  if (detail.card.mimeType.startsWith("image/")) {
    tags.push("#原画");
  }
  if (source.includes("flower") || source.includes("rose") || source.includes("花")) {
    tags.push("#花系");
  }
  if (source.includes("moon") || source.includes("night") || source.includes("海") || source.includes("sunset")) {
    tags.push("#氛围感");
  }

  return tags.length > 0 ? tags.slice(0, 4) : ["#卡片", "#分享"];
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
  const [manualUnlockCode, setManualUnlockCode] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setDownloadError("");

      const demoDetail = demoCardDetails[cardId];
      if (demoDetail) {
        setDetail(demoDetail);
        setLoading(false);
        return;
      }

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

  const unlockCode = manualUnlockCode || codeFromQuery;
  const updateUnlockCode = useCallback(
    (value: string) => {
      setManualUnlockCode(value.toUpperCase());
      if (downloadError) {
        setDownloadError("");
      }
    },
    [downloadError],
  );

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t-[4px] border-[var(--outline)] bg-white/92 px-5 py-10">
        <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center justify-between gap-5 md:flex-row">
          <div className="text-2xl font-black text-[var(--foreground)]">Dreamy CardShare</div>

          <div className="text-center text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--foreground)]/70 md:text-left">
            Copyright 2026 CardShare
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-black text-[var(--foreground)]/78">
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              About
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Privacy
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
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
  const fileKindLabel = detail ? getFileKindLabel(detail) : "";
  const tags = detail ? buildTags(detail) : [];
  const accessCodeStatus = detail?.accessCodeStatus ?? "none";
  const requiresAccessCode = Boolean(detail && !detail.canEdit && accessCodeStatus === "required");
  const normalizedUnlockCode = unlockCode.trim().toUpperCase();
  const unlockPlaceholder = requiresAccessCode
    ? "输入提取码（例如 SAKURA2024）"
    : accessCodeStatus === "expired"
      ? "当前提取码已过期"
      : accessCodeStatus === "exhausted"
        ? "当前提取码已达到上限"
        : "当前卡片无需提取码";

  const downloadHint = detail?.canEdit
    ? "你创建的卡片可以直接下载原始文件。"
    : requiresAccessCode
      ? "请输入提取码后再下载原图与附件。"
      : accessCodeStatus === "expired"
        ? "当前提取码已过期，暂时无法下载。"
        : accessCodeStatus === "exhausted"
          ? "当前提取码使用次数已达上限，暂时无法下载。"
          : "这张卡片支持直接下载，无需提取码。";

  async function handleProtectedDownload() {
    if (!detail || !requiresAccessCode) {
      return;
    }
    if (!normalizedUnlockCode) {
      setDownloadError("请输入提取码后再下载");
      return;
    }

    setDownloadPending(true);
    setDownloadError("");

    try {
      const downloadUrl = new URL(detail.card.downloadUrl, window.location.origin);
      downloadUrl.searchParams.set("code", normalizedUnlockCode);

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
      anchor.download = detail.card.originalFileName || "card-download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (downloadReason) {
      setDownloadError(getShareErrorMessage(downloadReason, "卡片下载失败，请稍后重试。"));
    } finally {
      setDownloadPending(false);
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
            <div className="mx-auto max-w-3xl rounded-3xl border-[4px] border-[var(--outline)] bg-[#ffe6de] px-6 py-5 text-sm font-bold text-[#8a2a14]">
              {error}
            </div>
          ) : null}

          {!loading && detail ? (
            <div className="fade-slide-in flex flex-col gap-8 lg:flex-row xl:gap-12">
              <section className="w-full shrink-0 lg:w-[55%] xl:w-[60%]">
                <div className="group relative h-[600px] overflow-hidden rounded-[2rem] border-[4px] border-[var(--outline)] bg-[var(--secondary)] p-3 md:h-[700px]">
                  <Link href="/discover" className="btn-subtle absolute left-6 top-6 z-20 rounded-full px-4 py-2 font-black">
                    ← 返回
                  </Link>

                  <div className="absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full border-[3px] border-[var(--outline)] bg-white px-4 py-2">
                    <HeartIcon className="h-5 w-5 text-[var(--brand)]" />
                    <span className="text-base font-black text-[var(--foreground)]">{metric}</span>
                  </div>

                  <div className="relative h-full w-full overflow-hidden rounded-[1.3rem] border-[3px] border-[var(--outline)] bg-[var(--outline)]">
                    {detail.card.mimeType.startsWith("image/") ? (
                      <img src={detail.card.previewUrl} alt={detail.card.title} className="h-full w-full object-cover opacity-86" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--outline)] px-8 text-center text-2xl font-black text-white/90">
                        {detail.card.originalFileName || detail.card.title}
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                      <h1 className="text-[2.5rem] font-black leading-[1.05] tracking-wide text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:text-5xl md:text-7xl">
                        {detail.card.title}
                      </h1>
                      <p className="mt-3 text-lg font-black text-white/90 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] md:text-2xl">CardShare</p>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(46,40,86,0)_0%,rgba(46,40,86,0.92)_100%)] px-6 pb-7 pt-24 md:px-8">
                      <h2 className="type-h2 text-white">作品详情</h2>
                      <p className="mt-1 text-base font-black text-white/86">Illustration by {creatorName}</p>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="w-full space-y-6 lg:w-[45%] xl:w-[40%]">
                <section className="rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-white p-6 sm:p-7">
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {detail.creator.avatar.trim() ? (
                        <img
                          src={detail.creator.avatar}
                          alt={creatorName}
                          className="h-14 w-14 shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--primary)] object-cover"
                        />
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
                      <Link
                        href="/creator"
                        className="shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--brand)] px-5 py-1.5 text-sm font-black text-[var(--foreground)]"
                      >
                        我的卡片
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--brand)] px-5 py-1.5 text-sm font-black text-[var(--foreground)]"
                      >
                        关注
                      </button>
                    )}
                  </div>

                  <h3 className="type-h2 text-[var(--foreground)]">卡片介绍</h3>
                  <p className="type-body mt-3 font-bold text-[var(--foreground)]/80">
                    {detail.card.description.trim() || "这是一张公开分享的卡片，你可以在这里预览并获取原始文件。"}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className={`inline-flex rounded-full border-[3px] border-[var(--outline)] px-4 py-1.5 text-sm font-black text-[var(--foreground)] ${
                          index % 4 === 0
                            ? "bg-[var(--secondary)]"
                            : index % 4 === 1
                              ? "bg-[var(--primary)]"
                              : index % 4 === 2
                                ? "bg-[var(--tertiary)]"
                                : "bg-[var(--accent)]"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="relative overflow-hidden rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-[var(--tertiary)] p-6 text-center sm:p-7">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/35 blur-lg" />

                  <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[var(--outline)] bg-white text-[var(--brand)]">
                    <KeyIcon className="h-6 w-6" />
                  </div>

                  <h3 className="type-h2 text-[var(--foreground)]">获取这张卡片</h3>
                  <p className="mt-2 text-sm font-bold text-[var(--foreground)]/78">支持原图下载，部分卡片需要提取码验证</p>

                  <div className="relative mt-6">
                    <input
                      type="text"
                      value={unlockCode}
                      onChange={(event) => {
                        updateUnlockCode(event.target.value);
                      }}
                      disabled={!requiresAccessCode}
                      placeholder={unlockPlaceholder}
                      className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-white px-4 py-3 pr-12 text-base font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:bg-white/70"
                    />
                    <LockIcon className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--foreground)]/36" />
                  </div>

                  {downloadError ? (
                    <p className="mt-4 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">{downloadError}</p>
                  ) : null}

                  {detail.canDownload ? (
                    requiresAccessCode ? (
                      <button
                        type="button"
                        disabled={downloadPending || !normalizedUnlockCode}
                        onClick={() => void handleProtectedDownload()}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[var(--button-primary)] px-5 py-3 text-lg font-black text-[var(--foreground)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>{downloadPending ? "验证中..." : "下载原图"}</span>
                        <DownloadIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <a
                        href={detail.card.downloadUrl}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[var(--outline)] bg-[var(--button-primary)] px-5 py-3 text-lg font-black text-[var(--foreground)] transition hover:bg-[var(--button-primary-hover)]"
                      >
                        <span>下载原图</span>
                        <DownloadIcon className="h-5 w-5" />
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 w-full rounded-2xl border-[3px] border-[var(--outline)] bg-[#d6d2e6] px-5 py-3 text-lg font-black text-[var(--foreground)]/72"
                    >
                      {accessCodeStatus === "expired" ? "提取码已过期" : accessCodeStatus === "exhausted" ? "提取码已达上限" : "暂无下载权限"}
                    </button>
                  )}

                  <p className="mt-4 text-xs font-bold text-[var(--foreground)]/72">{downloadHint}</p>
                </section>

                <section className="rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--outline)] bg-[var(--brand)] text-[var(--foreground)]">
                        <InfoIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-black text-[var(--foreground)]/78">文件信息</p>
                        <p className="truncate text-lg font-black text-[var(--foreground)]">
                          {fileKindLabel} ({formatBytes(detail.card.size)})
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--accent)] px-3 py-1 text-sm font-black text-[var(--foreground)]">
                      {detail.canEdit ? "我的卡片" : "可下载"}
                    </span>
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

function KeyIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9.75 12a4.5 4.5 0 1 1 3.66 4.42l-1.33 1.33h-1.83v1.5H8.75v1.5H6.5v-2.25l3.25-3.25A4.48 4.48 0 0 1 9.75 12Zm4.5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm2.25-2.25h5.25v1.5H20.5v1.5H19v1.5h-1.5v-1.5H16v-1.5h1.5v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 10.5V8.25a4.5 4.5 0 1 1 9 0v2.25h.75A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21h-10.5A2.25 2.25 0 0 1 4.5 18.75v-6A2.25 2.25 0 0 1 6.75 10.5h.75Zm1.5 0h6V8.25a3 3 0 0 0-6 0v2.25Zm-2.25 1.5a.75.75 0 0 0-.75.75v6c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-.75-.75h-10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12.75 3.75v9.69l2.72-2.72 1.06 1.06L12 16.31l-4.53-4.53 1.06-1.06 2.72 2.72V3.75h1.5Zm-7.5 14.25h13.5v1.5H5.25V18Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.75A8.25 8.25 0 1 1 3.75 12 8.26 8.26 0 0 1 12 3.75Zm0 1.5A6.75 6.75 0 1 0 18.75 12 6.76 6.76 0 0 0 12 5.25Zm-.75 5.25h1.5v6h-1.5v-6Zm0-3h1.5V9h-1.5V7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
