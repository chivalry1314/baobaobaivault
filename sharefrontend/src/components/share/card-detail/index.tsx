"use client";

import { useMemo } from "react";

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

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t-[4px] border-[var(--outline)] bg-white/92 px-5 py-10">
        <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center justify-between gap-5 md:flex-row">
          <div className="text-2xl font-black text-[var(--foreground)]">Dreamy CardShare</div>
          <div className="text-center text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--foreground)]/70 md:text-left">
            Copyright 2026 CardShare
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-black text-[var(--foreground)]/78">
            <a href="/" className="transition hover:text-[var(--brand-strong)]">
              About
            </a>
            <a href="/" className="transition hover:text-[var(--brand-strong)]">
              Privacy
            </a>
            <a href="/" className="transition hover:text-[var(--brand-strong)]">
              Terms
            </a>
          </div>
        </div>
      </footer>
    ),
    [],
  );

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
