import Link from "next/link";

import { AccessModeBadge } from "@/components/share/access-mode-badge";
import { FavoriteButton } from "@/components/share/favorite-button";
import { ShareImage } from "@/components/share/share-image";
import { SLOT_LABEL_MAP } from "@/components/share/card-detail/constants";
import { formatBytes, formatMetric, getInitials } from "@/components/share/card-detail/helpers";
import { DesktopComponentPreview } from "@/components/share/card-detail/desktop-component-preview";
import { WechatThemePreview } from "@/components/share/card-detail/wechat-theme-preview";
import type { CardViewModel } from "@/components/share/card-detail/types";
import type { CardAsset, CardContentSlot, CardDetailResponse } from "@/lib/shared";

export function CardDetailLoading() {
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="w-full shrink-0 space-y-4 lg:w-[50%] xl:w-[52%]">
        <div className="aspect-[3/4] w-full animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
        <div className="h-24 w-full animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
      </div>
      <div className="w-full space-y-4 lg:w-[50%] xl:w-[48%]">
        <div className="h-48 w-full animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
        <div className="h-56 w-full animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
        <div className="h-40 w-full animate-pulse rounded-[1.4rem] border-2 border-[var(--outline)] bg-white/70" />
      </div>
    </div>
  );
}

export function CardDetailError(props: { error: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border-2 border-[var(--outline)] bg-[#ffe6de] px-6 py-5 text-sm font-bold text-[#8a2a14]">
      {props.error}
    </div>
  );
}

export function CardDetailContent(props: {
  detail: CardDetailResponse;
  viewModel: CardViewModel;
  unlockCode: string;
  setUnlockCode: (value: string) => void;
  downloadPendingSlot: string;
  downloadError: string;
  setDownloadError: (value: string) => void;
  onAssetDownload: (asset: CardAsset) => void;
  onToggleFavorite?: (nextFavorited: boolean, nextCount: number) => void;
}) {
  const {
    detail,
    viewModel,
    unlockCode,
    setUnlockCode,
    downloadPendingSlot,
    downloadError,
    setDownloadError,
    onAssetDownload,
    onToggleFavorite,
  } = props;

  const themeCardTitle = detail.card.title.trim() || detail.systemTheme?.name || "未命名系统主题";
  const themeCardDescription =
    detail.card.description.trim() ||
    detail.systemTheme?.description ||
    "当前主题包未提供额外说明，可直接按卡片规则下载后导入系统主题。";
  const themePackageName = detail.systemTheme?.name.trim() || themeCardTitle;
  const themePackageDescription = detail.systemTheme?.description.trim() || themeCardDescription;

  return (
    <div className="fade-slide-in flex flex-col gap-5 lg:flex-row lg:items-start">
      <section className="flex w-full flex-col lg:w-[50%] xl:w-[52%]">
        <div className="overflow-hidden rounded-[1.4rem] border-2 border-[var(--outline)] bg-white shadow-sm">
          <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--secondary)]">
            {viewModel.heroImageUrl ? (
              <ShareImage
                src={viewModel.heroImageUrl}
                alt={detail.card.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--secondary)] px-8 text-center text-2xl font-black text-[var(--foreground)]/50">
                {viewModel.heroFallbackText}
              </div>
            )}

            <div className="absolute right-4 top-4 z-10">
              <FavoriteButton
                cardId={detail.card.id}
                initialFavorited={detail.isFavorited}
                initialCount={detail.stats.favoriteCount}
                className="px-3 py-1.5 text-xs"
                onToggle={onToggleFavorite}
              />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-2xl">
                {detail.card.title}
              </h1>
              <AccessModeBadge mode={detail.card.accessMode} />
            </div>
            <p className="mt-1.5 text-xs font-bold text-[var(--foreground)]/60">
              {detail.card.description.trim() || "暂无卡片副标题"}
            </p>

            {detail.card.tags.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {detail.card.tags.map((tag, index) => (
                  <span
                    key={`card-tag-${tag}-${index}`}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black text-[var(--foreground)] ${
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
            ) : null}

            {detail.wechatTheme ? <WechatThemePreview detail={detail} unlockCode={unlockCode} /> : null}

            {detail.desktopComponent ? <DesktopComponentPreview detail={detail} unlockCode={unlockCode} /> : null}

            {detail.wechatTheme?.features && detail.wechatTheme.features.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.wechatTheme.features.map((feature) => {
                  const featureLabels: Record<string, string> = {
                    bubble: "气泡",
                    background: "背景",
                    stickers: "表情包",
                    renderer: "渲染源码",
                  };
                  return (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[11px] font-black text-[var(--foreground)]/80"
                    >
                      {featureLabels[feature] || feature}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatPill icon={<DownloadIcon className="h-3.5 w-3.5" />} label="下载" value={formatMetric(detail.stats.downloadCount)} />
              <StatPill icon={<HeartIcon className="h-3.5 w-3.5" />} label="收藏" value={formatMetric(detail.stats.favoriteCount)} />
              {detail.stats.lastDownloadedAt ? (
                <span className="text-xs font-bold text-[var(--foreground)]/45">
                  最近下载 {new Date(detail.stats.lastDownloadedAt).toLocaleDateString("zh-CN")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <aside className="w-full space-y-4 lg:w-[50%] xl:w-[48%]">
        <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            {detail.creator.avatar.trim() ? (
              <ShareImage
                src={detail.creator.avatar}
                alt={viewModel.creatorName}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full border-2 border-[var(--outline)]/15 bg-[var(--primary)] object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--outline)]/15 bg-[var(--primary)] text-sm font-black text-[var(--foreground)]">
                {getInitials(viewModel.creatorName)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black text-[var(--foreground)]">{viewModel.creatorName}</h2>
              <p className="truncate text-[11px] font-bold text-[var(--foreground)]/55">{viewModel.creatorHandle}</p>
            </div>

            {detail.canEdit ? (
              <Link
                href="/creator"
                className="shrink-0 rounded-full bg-[var(--button-primary)] px-3.5 py-1.5 text-[11px] font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
              >
                我的卡片
              </Link>
            ) : null}
          </div>

          <div className="mt-4 rounded-[1rem] bg-[var(--surface-container)] p-3">
            <p className="text-xs font-bold leading-relaxed text-[var(--foreground)]/78">
              {detail.card.description.trim() || "这是一张公开分享卡片，你可以预览内容并按规则下载分类文件。"}
            </p>

            {viewModel.tags.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {viewModel.tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black text-[var(--foreground)] ${
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
            ) : null}
          </div>
        </section>

        {detail.systemTheme ? (
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary)] text-base">📦</span>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">系统主题协议</h3>
                  <p className="text-[10px] font-bold text-[var(--foreground)]/55">baobaobaiphone 可安装</p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                  detail.systemTheme.supported
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "bg-[var(--accent)] text-[var(--foreground)]"
                }`}
              >
                {detail.systemTheme.supported ? "已识别协议" : "待校验协议"}
              </span>
            </div>

            <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/12 bg-[var(--surface-container)] p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">协议</p>
                  <p className="mt-0.5 truncate font-mono font-black text-[var(--foreground)]/90">{detail.systemTheme.protocol}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">格式</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">{detail.systemTheme.format.toUpperCase()}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">大小</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">{formatBytes(detail.systemTheme.size)}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">版本</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">
                    {detail.systemTheme.version ? `v${detail.systemTheme.version}` : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-2 rounded-lg bg-white px-2.5 py-2">
                <p className="text-[10px] font-bold text-[var(--foreground)]/50">文件名</p>
                <p className="mt-0.5 truncate font-mono font-black text-[var(--foreground)]/90">{detail.systemTheme.fileName}</p>
              </div>

              {detail.systemTheme.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detail.systemTheme.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--foreground)]/75"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {(themePackageName !== themeCardTitle || themePackageDescription !== themeCardDescription) && (
                <div className="mt-2 rounded-[0.7rem] border border-dashed border-[var(--outline)]/20 bg-white p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--foreground)]/50">
                    主题包内信息
                  </p>
                  <p className="mt-1 text-xs font-black text-[var(--foreground)]">{themePackageName}</p>
                  <p className="mt-0.5 text-[10px] font-bold leading-relaxed text-[var(--foreground)]/70">
                    {themePackageDescription}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {detail.characterPersona ? (
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary)] text-base">🧸</span>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">角色人设协议</h3>
                  <p className="text-[10px] font-bold text-[var(--foreground)]/55">baobaobaiphone 可安装</p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                  detail.characterPersona.supported
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "bg-[var(--accent)] text-[var(--foreground)]"
                }`}
              >
                {detail.characterPersona.supported ? "已识别协议" : "待校验协议"}
              </span>
            </div>

            <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/12 bg-[var(--surface-container)] p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">协议</p>
                  <p className="mt-0.5 truncate font-mono font-black text-[var(--foreground)]/90">{detail.characterPersona.protocol}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">格式</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">{detail.characterPersona.format.toUpperCase()}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">大小</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">{formatBytes(detail.characterPersona.size)}</p>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[var(--foreground)]/50">联系人</p>
                  <p className="mt-0.5 font-black text-[var(--foreground)]/90">{detail.characterPersona.contactCount} 位</p>
                </div>
              </div>

              <div className="mt-2 rounded-lg bg-white px-2.5 py-2">
                <p className="text-[10px] font-bold text-[var(--foreground)]/50">文件名</p>
                <p className="mt-0.5 truncate font-mono font-black text-[var(--foreground)]/90">{detail.characterPersona.fileName}</p>
              </div>

              {detail.characterPersona.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detail.characterPersona.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--foreground)]/75"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tertiary)] text-base">⬇️</span>
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)]">下载分享卡片</h3>
              <p className="text-[10px] font-bold text-[var(--foreground)]/55">
                {viewModel.isPaid ? "需提取码" : "免费"} · 支持多种内容类型
              </p>
            </div>
          </div>

          {viewModel.isPaid ? (
            <div className="relative mt-3">
              <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/40" />
              <input
                type="text"
                value={unlockCode}
                onChange={(event) => {
                  setUnlockCode(event.target.value.toUpperCase());
                  if (downloadError) {
                    setDownloadError("");
                  }
                }}
                placeholder="请输入提取码（示例：SHARE2026）"
                className="w-full rounded-xl border-2 border-[var(--primary)]/30 bg-white px-3.5 py-3 pl-10 text-sm font-black text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/20"
              />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--outline)]/12 bg-[var(--surface-container)] px-3.5 py-2.5">
              <span className="flex h-2 w-2 rounded-full bg-[#2fbf71]" />
              <span className="text-xs font-bold text-[var(--foreground)]/70">当前卡片无需提取码，可直接下载</span>
            </div>
          )}

          {downloadError ? (
            <p className="mt-2.5 rounded-xl border border-[#e59273] bg-[#ffe8dd] px-3.5 py-2 text-xs font-bold text-[#8a2a14]">
              {downloadError}
            </p>
          ) : null}

          <div className="mt-4">
            <h4 className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/50">分类文件</h4>
            <div className="mt-2 space-y-2">
              {detail.assets.map((asset) => {
                const pending = downloadPendingSlot === asset.slot;
                const canDownload =
                  detail.canDownload && (!viewModel.requiresAccessCode || Boolean(viewModel.normalizedUnlockCode));

                return (
                  <div
                    key={asset.slot}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--outline)]/10 bg-[var(--surface-container)] p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/30 text-sm">
                        {SLOT_EMOJI_MAP[asset.slot] ?? "📄"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[var(--foreground)]">{SLOT_LABEL_MAP[asset.slot]}</p>
                        <p className="truncate text-[10px] font-bold text-[var(--foreground)]/55">{asset.originalFileName}</p>
                        <p className="text-[10px] font-bold text-[var(--text-subtle)]">
                          {asset.mimeType} · {formatBytes(asset.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[var(--button-primary)] px-3 py-1.5 text-[10px] font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pending || !canDownload}
                      onClick={() => onAssetDownload(asset)}
                    >
                      {pending ? "下载中..." : "下载"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {viewModel.isPaid && !viewModel.normalizedUnlockCode ? (
            <p className="mt-3 text-[11px] font-bold text-[var(--foreground)]/55">
              请先输入提取码，验证通过后下方“下载”按钮才会启用。
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

const SLOT_EMOJI_MAP: Record<CardContentSlot, string> = {
  system_theme: "🎨",
  wechat_theme: "💬",
  app: "📱",
  character_persona: "🧸",
  world_book: "📖",
  desktop_component: "🧩",
};

function StatPill(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[11px] font-black text-[var(--foreground)]/80">
      {props.icon}
      <span>
        {props.label} {props.value}
      </span>
    </span>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="12.5" r="3.5" />
      <path d="M11 12.5h10" />
      <path d="M17 12.5v3" />
      <path d="M14 12.5v2" />
    </svg>
  );
}
