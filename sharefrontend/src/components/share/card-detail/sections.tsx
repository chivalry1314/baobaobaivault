import Link from "next/link";

import { AccessModeBadge } from "@/components/share/access-mode-badge";
import { SLOT_LABEL_MAP } from "@/components/share/card-detail/constants";
import { formatBytes, getInitials } from "@/components/share/card-detail/helpers";
import type { CardViewModel } from "@/components/share/card-detail/types";
import type { CardAsset, CardDetailResponse } from "@/lib/shared";

export function CardDetailLoading() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row xl:gap-12">
      <div className="h-[580px] w-full animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70 lg:h-[700px] lg:w-[58%]" />
      <div className="w-full space-y-6 lg:w-[42%]">
        <div className="h-[290px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
        <div className="h-[300px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
        <div className="h-[110px] animate-pulse rounded-[2rem] border-[4px] border-[var(--outline)] bg-white/70" />
      </div>
    </div>
  );
}

export function CardDetailError(props: { error: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border-[4px] border-[var(--outline)] bg-[#ffe6de] px-6 py-5 text-sm font-bold text-[#8a2a14]">
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
  } = props;

  return (
    <div className="fade-slide-in flex flex-col gap-8 lg:flex-row xl:gap-12">
      <section className="w-full shrink-0 lg:w-[55%] xl:w-[60%]">
        <div className="group relative h-[600px] overflow-hidden rounded-[2rem] border-[4px] border-[var(--outline)] bg-[var(--secondary)] p-3 md:h-[700px]">
          <Link href="/" className="btn-subtle absolute left-6 top-6 z-20 rounded-full px-4 py-2 font-black">
            返回
          </Link>

          <div className="absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full border-[3px] border-[var(--outline)] bg-white px-4 py-2">
            <HeartIcon className="h-5 w-5 text-[var(--brand)]" />
            <span className="text-base font-black text-[var(--foreground)]">{viewModel.metric}</span>
          </div>

          <div className="relative h-full w-full overflow-hidden rounded-[1.3rem] border-[3px] border-[var(--outline)] bg-[var(--outline)]">
            {viewModel.heroImageUrl ? (
              <img src={viewModel.heroImageUrl} alt={detail.card.title} className="h-full w-full object-cover opacity-86" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--outline)] px-8 text-center text-2xl font-black text-white/90">
                {viewModel.heroFallbackText}
              </div>
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
                <img src={detail.creator.avatar} alt={viewModel.creatorName} className="h-14 w-14 shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--primary)] object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--outline)] bg-[var(--primary)] text-base font-black text-[var(--foreground)]">
                  {getInitials(viewModel.creatorName)}
                </div>
              )}

              <div className="min-w-0">
                <h2 className="truncate text-xl font-black text-[var(--foreground)]">{viewModel.creatorName}</h2>
                <p className="text-sm font-bold text-[var(--foreground)]/70">{viewModel.creatorHandle}</p>
              </div>
            </div>

            {detail.canEdit ? (
              <Link href="/creator" className="shrink-0 rounded-full border-[3px] border-[var(--outline)] bg-[var(--brand)] px-5 py-1.5 text-sm font-black text-[var(--foreground)]">
                我的卡片
              </Link>
            ) : null}
          </div>

          <h3 className="type-h2 text-[var(--foreground)]">卡片描述</h3>
          <div className="mt-3">
            <AccessModeBadge mode={detail.card.accessMode} />
          </div>
          <p className="type-body mt-3 font-bold text-[var(--foreground)]/80">
            {detail.card.description.trim() || "这是一张公开分享卡片，你可以预览内容并按规则下载分类文件。"}
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {viewModel.tags.map((tag, index) => (
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
          <h3 className="type-h2 text-[var(--foreground)]">下载分享卡片</h3>
          <p className="mt-2 text-sm font-bold text-[var(--foreground)]/78">
            {viewModel.isPaid
              ? "付费卡片需输入提取码后下载，支持系统主题、微信主题、App、角色人设、世界书。"
              : "免费卡片可直接下载，支持系统主题、微信主题、App、角色人设、世界书。"}
          </p>

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
              disabled={!viewModel.isPaid}
              placeholder={
                viewModel.isPaid
                  ? "请输入提取码（示例：SHARE2026）"
                  : "当前卡片无需提取码"
              }
              className="w-full rounded-2xl border-[3px] border-[var(--outline)] bg-white px-4 py-3 text-base font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:bg-white/70"
            />
          </div>

          {downloadError ? (
            <p className="mt-4 rounded-xl border-[3px] border-[#e59273] bg-[#ffe8dd] px-4 py-2 text-sm font-bold text-[#8a2a14]">
              {downloadError}
            </p>
          ) : null}

          <p className="mt-4 text-xs font-bold text-[var(--foreground)]/72">{viewModel.downloadHint}</p>
        </section>

        <section className="rounded-[1.8rem] border-[4px] border-[var(--outline)] bg-white p-5">
          <p className="text-sm font-black text-[var(--foreground)]/78">分类文件</p>
          <div className="mt-3 space-y-3">
            {detail.assets.map((asset) => {
              const pending = downloadPendingSlot === asset.slot;
              const canDownload =
                detail.canDownload &&
                (!viewModel.requiresAccessCode || Boolean(viewModel.normalizedUnlockCode));
              return (
                <div key={asset.slot} className="rounded-xl border-[2px] border-[var(--outline)]/30 bg-[#f8f9fa] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--foreground)]">
                        {SLOT_LABEL_MAP[asset.slot]}
                      </p>
                      <p className="truncate text-xs font-bold text-[var(--foreground)]/70">
                        {asset.originalFileName}
                      </p>
                      <p className="text-xs font-bold text-[var(--text-subtle)]">
                        {asset.mimeType} · {formatBytes(asset.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary shrink-0 rounded-full px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pending || !canDownload}
                      onClick={() => onAssetDownload(asset)}
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
  );
}

function HeartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}
