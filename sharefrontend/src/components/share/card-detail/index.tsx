"use client";

import Link from "next/link";

import { AppShell } from "@/components/share/app-shell";
import { CardDetailContent, CardDetailError, CardDetailLoading } from "@/components/share/card-detail/sections";
import { useCardDetail } from "@/components/share/card-detail/hooks";
import type { CardDetailClientPageProps } from "@/components/share/card-detail/types";

export default function CardDetailClientPage({
  cardId,
  initialDetail,
}: CardDetailClientPageProps) {
  const {
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
    toggleFavorite,
  } = useCardDetail({ cardId, initialDetail });

  return (
    <AppShell currentPath="/">
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sparkle-orb left-[-8%] top-[18%] h-[16rem] w-[16rem] bg-[rgba(174,231,217,0.46)]" />
          <div className="sparkle-orb right-[-10%] top-[42%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.34)]" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[var(--layout-max)] px-4 pb-16 pt-10 sm:px-6">
          {!loading && !error && detail ? (
            <div className="mb-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--outline)]/15 bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)] hover:-translate-y-0.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                返回
              </Link>
            </div>
          ) : null}
          {loading ? <CardDetailLoading /> : null}
          {!loading && error ? <CardDetailError error={error} /> : null}
          {!loading && detail ? (
            <CardDetailContent
              detail={detail}
              viewModel={viewModel}
              unlockCode={unlockCode}
              setUnlockCode={setUnlockCode}
              downloadPendingSlot={downloadPendingSlot}
              downloadError={downloadError}
              setDownloadError={setDownloadError}
              onAssetDownload={(asset) => {
                void handleAssetDownload(asset);
              }}
              onToggleFavorite={toggleFavorite}
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
