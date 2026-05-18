"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
        "在春天的最后一个傍晚，樱花如雪般飘落。这张卡片收藏了一次温柔告白的瞬间，适合分享、收藏，也适合作为纪念原图长期保存。",
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
        "日落把海平面染成了柔软的橘粉色，整张图以低饱和氛围光为主，适合做封面、头像背景和浪漫分享卡片。",
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
  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
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

  useEffect(() => {
    const codeFromQuery = searchParams.get("code")?.trim();
    if (!codeFromQuery) {
      return;
    }

    setUnlockCode(codeFromQuery.toUpperCase());
    setDownloadError("");
  }, [searchParams]);

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t border-white/60 bg-[rgba(240,248,252,0.72)] px-6 py-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="text-3xl font-semibold italic tracking-tight text-[var(--primary)]">CardShare</div>

          <div className="text-sm tracking-[0.14em] text-[var(--primary)]/55">© 2024 CARDSHARE. HANDCRAFTED WITH SAKURA DREAMS.</div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm uppercase tracking-[0.12em] text-[var(--primary)]/48">
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              About Us
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Privacy Policy
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Terms Of Service
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Help Center
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
    ? "输入提取码（如 SAKURA2024）"
    : accessCodeStatus === "expired"
      ? "当前提取码已过期"
      : accessCodeStatus === "exhausted"
        ? "当前提取码已达上限"
        : "当前卡片无需提取码";

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
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f7fcff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-6%] top-[6%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[24%] h-[25rem] w-[25rem] rounded-full bg-[rgba(205,233,249,0.32)] blur-[120px]" />
          <div className="absolute bottom-[-8%] left-[18%] h-[26rem] w-[26rem] rounded-full bg-[rgba(248,219,230,0.24)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1540px] px-4 pb-16 pt-12 sm:px-6">
          {loading ? (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.48fr)_minmax(360px,0.92fr)]">
              <div className="min-h-[720px] animate-pulse rounded-[42px] border border-white/80 bg-white/70" />
              <div className="space-y-6">
                <div className="h-[360px] animate-pulse rounded-[40px] border border-white/80 bg-white/70" />
                <div className="h-[360px] animate-pulse rounded-[40px] border border-white/80 bg-white/70" />
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mx-auto max-w-3xl rounded-[28px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-5 text-sm text-[#9a3412]">
              {error}
            </div>
          ) : null}

          {!loading && detail ? (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.48fr)_minmax(360px,0.92fr)]">
              <section className="relative overflow-hidden rounded-[42px] border border-[rgba(193,219,232,0.72)] bg-[rgba(251,255,255,0.82)] p-4 shadow-[0_30px_80px_-46px_rgba(80,118,140,0.3)] sm:p-5">
                <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#2f1f25_0%,#5d424c_100%)]">
                  <div className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-3 text-lg font-semibold text-[var(--foreground)] shadow-[0_18px_36px_-28px_rgba(0,0,0,0.45)]">
                    <HeartIcon className="h-5 w-5 text-[var(--brand-strong)]" />
                    <span>{metric}</span>
                  </div>

                  {detail.card.mimeType.startsWith("image/") ? (
                    <img src={detail.card.previewUrl} alt={detail.card.title} className="h-full min-h-[720px] w-full object-cover" />
                  ) : (
                    <div className="flex min-h-[720px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] px-10 text-center text-xl font-medium text-white/88 sm:text-2xl">
                      {detail.card.originalFileName || detail.card.title}
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(22,12,15,0)_0%,rgba(22,12,15,0.08)_26%,rgba(22,12,15,0.72)_100%)] px-8 pb-9 pt-24 sm:px-10">
                    <h1 className="type-h1 text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                      {detail.card.title}
                    </h1>
                    <p className="type-h3 mt-3 text-white/92">Illustration by {creatorName}</p>
                  </div>
                </div>
              </section>

              <aside className="space-y-8">
                <section className="relative overflow-hidden rounded-[40px] border border-[rgba(193,219,232,0.78)] bg-[rgba(251,255,255,0.9)] p-7 shadow-[0_30px_70px_-50px_rgba(80,118,140,0.28)] sm:p-8">
                  <div aria-hidden="true" className="absolute right-6 top-[-24px] h-20 w-20 rotate-45 rounded-[24px] bg-[rgba(222,241,250,0.82)]" />

                  <div className="relative flex items-start gap-4">
                    {detail.creator.avatar.trim() ? (
                      <img
                        src={detail.creator.avatar}
                        alt={creatorName}
                        className="h-16 w-16 rounded-full object-cover shadow-[0_16px_34px_-24px_rgba(120,85,94,0.45)]"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e3f4fb_0%,#f5fbff_100%)] text-xl font-semibold text-[var(--primary)]">
                        {getInitials(creatorName)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="type-h2 truncate text-[var(--foreground)]">{creatorName}</h2>
                        {detail.canEdit ? (
                          <Link
                            href="/creator"
                            className="inline-flex rounded-full bg-[var(--brand-soft)] px-5 py-2 text-sm font-medium text-[var(--brand-strong)] transition hover:opacity-90"
                          >
                            我的卡片
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex rounded-full bg-[var(--brand-soft)] px-5 py-2 text-sm font-medium text-[var(--brand-strong)] transition hover:opacity-90"
                          >
                            关注
                          </button>
                        )}
                      </div>
                      <p className="type-body-sm mt-2 text-[var(--foreground)]/72">{creatorHandle}</p>
                    </div>
                  </div>

                  <div className="relative mt-10">
                    <h3 className="type-h1 text-[var(--foreground)]">卡片详情</h3>
                    <p className="type-body mt-5 text-[var(--foreground)]/78">
                      {detail.card.description.trim() || "这是一张公开分享的卡片作品，你可以在这里查看预览并直接获取原始文件。"}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    {tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-medium ${
                          index === 0
                            ? "bg-[rgba(215,239,250,0.9)] text-[#2d728d]"
                            : index === 1
                              ? "bg-[rgba(248,219,230,0.9)] text-[#9b5b74]"
                              : "bg-[rgba(226,240,248,0.9)] text-[#4b6470]"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-10 h-2 rounded-full bg-[repeating-linear-gradient(90deg,rgba(207,233,245,0.8)_0,rgba(207,233,245,0.8)_16px,rgba(255,255,255,0)_16px,rgba(255,255,255,0)_24px)]" />
                </section>

                <section className="rounded-[40px] border border-[rgba(193,219,232,0.78)] bg-[rgba(235,248,254,0.82)] p-7 shadow-[0_30px_70px_-50px_rgba(80,118,140,0.28)] sm:p-8">
                  <div className="flex justify-center text-[var(--brand-strong)]/78">
                    <KeyIcon className="h-12 w-12" />
                  </div>

                  <h3 className="type-h2 mt-5 text-center text-[var(--foreground)]">获取此卡片</h3>
                  <p className="type-body-sm mt-3 text-center text-[var(--foreground)]/68">请输入提取码以解锁高清原图及附件</p>

                  <div className="relative mt-8">
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
                      placeholder={unlockPlaceholder}
                      className="w-full rounded-full border border-[var(--outline-variant)] bg-white px-7 py-4 pr-16 text-base text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground)]/32 disabled:cursor-not-allowed disabled:bg-[rgba(242,248,252,0.85)] disabled:text-[var(--foreground)]/42 focus:border-[var(--primary)] sm:py-5 sm:text-lg"
                    />
                    <LockIcon className="pointer-events-none absolute right-6 top-1/2 h-7 w-7 -translate-y-1/2 text-[var(--foreground)]/36" />
                  </div>

                  {downloadError ? (
                    <p className="mt-4 rounded-[20px] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{downloadError}</p>
                  ) : null}

                  {detail.canDownload ? (
                    requiresAccessCode ? (
                      <button
                        type="button"
                        disabled={downloadPending || !normalizedUnlockCode}
                        onClick={() => void handleProtectedDownload()}
                        className="btn-primary mt-7 flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:py-5 sm:text-xl"
                      >
                        <span>{downloadPending ? "验证中..." : "提取此卡片"}</span>
                        <DownloadIcon className="h-7 w-7" />
                      </button>
                    ) : (
                      <a
                        href={detail.card.downloadUrl}
                        className="btn-primary mt-7 flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-lg font-semibold sm:py-5 sm:text-xl"
                      >
                        <span>提取此卡片</span>
                        <DownloadIcon className="h-7 w-7" />
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-7 w-full rounded-full bg-[rgba(125,90,115,0.48)] px-6 py-4 text-lg font-semibold text-white/88 sm:py-5 sm:text-xl"
                    >
                      {accessCodeStatus === "expired" ? "提取码已过期" : accessCodeStatus === "exhausted" ? "提取码已达上限" : "暂无下载权限"}
                    </button>
                  )}

                  <p className="mt-4 text-center text-sm text-[var(--foreground)]/52">
                    {detail.canEdit
                      ? "你创建的卡片可直接获取原始文件。"
                      : requiresAccessCode
                        ? "请输入提取码以解锁高清原图及附件。"
                        : accessCodeStatus === "expired"
                          ? "当前提取码已过期，暂时无法下载原图和附件。"
                          : accessCodeStatus === "exhausted"
                            ? "当前提取码使用次数已达上限，暂时无法下载。"
                            : "公开卡片当前无需校验提取码，直接点击按钮即可下载。"}
                  </p>
                </section>

                <section className="rounded-[36px] border border-[rgba(193,219,232,0.78)] bg-[rgba(251,255,255,0.9)] p-6 shadow-[0_30px_70px_-50px_rgba(80,118,140,0.26)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(240,211,216,0.88)] text-[var(--brand-strong)]">
                      <InfoIcon className="h-7 w-7" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="type-h3 text-[var(--foreground)]">包含文件</p>
                      <p className="type-h2 mt-1 text-[var(--foreground)]/78">
                        {fileKindLabel}（{formatBytes(detail.card.size)}）
                      </p>
                    </div>

                    <span className="rounded-full bg-[var(--brand-soft)] px-4 py-1.5 text-sm font-medium text-[var(--brand-strong)]">
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
