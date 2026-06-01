"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { useShareCardAccessCode } from "@/components/share/card-access-code/hooks";
import {
  AccessCodeCardPreview,
  AccessCodeError,
  AccessCodeFormPanel,
  AccessCodeHero,
  AccessCodeLoadingSkeleton,
  AccessCodeWizardSteps,
} from "@/components/share/card-access-code/sections";
import type { ShareCardAccessCodeProps } from "@/components/share/card-access-code/types";

export function ShareCardAccessCode({ cardId }: ShareCardAccessCodeProps) {
  const searchParams = useSearchParams();
  const isWizardFlow = searchParams.get("flow") === "new-access-code";
  const backHref = "/creator/access-codes";
  const afterSuccessHref = isWizardFlow
    ? `/creator/cards/${encodeURIComponent(cardId)}/access-code?flow=new-access-code`
    : `/creator/cards/${encodeURIComponent(cardId)}/access-code`;

  const {
    sessionChecking,
    loading,
    currentUser,
    detail,
    config,
    code,
    setCode,
    expireDays,
    setExpireDays,
    unlimited,
    setUnlimited,
    usageLimit,
    setUsageLimit,
    pending,
    error,
    success,
    setCodeRandom,
    handleSubmit,
  } = useShareCardAccessCode({ cardId, isWizardFlow });

  const footer = useMemo(
    () => (
      <footer className="relative z-10 px-6 pb-10 pt-12 text-center text-sm tracking-[0.08em] text-[color-mix(in_srgb,var(--brand)_28%,var(--foreground))]">
        (c) 2026 CardShare
      </footer>
    ),
    [],
  );

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          姝ｅ湪楠岃瘉鐧诲綍鐘舵€?..
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessHref} />;
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-8%] top-[14%] h-[24rem] w-[24rem] rounded-full bg-[rgba(203,234,249,0.34)] blur-[120px]" />
          <div className="absolute left-[18%] bottom-[8%] h-[24rem] w-[24rem] rounded-full bg-[rgba(248,219,230,0.22)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[var(--layout-max)] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
          {isWizardFlow ? <AccessCodeWizardSteps /> : null}
          <AccessCodeHero backHref={backHref} />

          {loading ? <AccessCodeLoadingSkeleton /> : null}
          {!loading && error ? <AccessCodeError message={error} /> : null}

          {!loading && detail ? (
            <div className="mt-10 grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
              <AccessCodeCardPreview detail={detail} />
              <AccessCodeFormPanel
                code={code}
                setCode={setCode}
                setCodeRandom={setCodeRandom}
                expireDays={expireDays}
                setExpireDays={setExpireDays}
                unlimited={unlimited}
                setUnlimited={setUnlimited}
                usageLimit={usageLimit}
                setUsageLimit={setUsageLimit}
                config={config}
                success={success}
                pending={pending}
                onSubmit={() => {
                  void handleSubmit();
                }}
              />
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

