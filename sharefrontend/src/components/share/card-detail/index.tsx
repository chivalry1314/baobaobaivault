"use client";

import { AppShell } from "@/components/share/app-shell";
import { CardDetailContent, CardDetailError, CardDetailLoading } from "@/components/share/card-detail/sections";
import { useCardDetail } from "@/components/share/card-detail/hooks";
import type { CardDetailClientPageProps } from "@/components/share/card-detail/types";

export default function CardDetailClientPage({ cardId }: CardDetailClientPageProps) {
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
  } = useCardDetail({ cardId });

  return (
    <AppShell currentPath="/">
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="doodle-cloud left-[5%] top-[8%] h-[46px] w-[170px] opacity-50" />
          <div className="doodle-cloud right-[8%] top-[20%] h-[52px] w-[190px] opacity-40" />
          <div className="sparkle-orb left-[-8%] top-[18%] h-[16rem] w-[16rem] bg-[rgba(174,231,217,0.46)]" />
          <div className="sparkle-orb right-[-10%] top-[42%] h-[20rem] w-[20rem] bg-[rgba(250,205,244,0.34)]" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[var(--layout-max)] px-4 pb-16 pt-10 sm:px-6">
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
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
