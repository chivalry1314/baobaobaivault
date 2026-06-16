"use client";

import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { LoadingSpinner } from "@/components/share/loading-spinner";
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
    accessMode,
    setAccessMode,
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

  if (sessionChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          <LoadingSpinner label="正在验证登录状态..." />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessHref} />;
  }

  return (
    <AppShell currentPath="/creator">
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[12%] h-[18rem] w-[18rem] rounded-full bg-[rgba(176,232,249,0.34)] blur-[100px]" />
          <div className="absolute right-[-6%] top-[20%] h-[16rem] w-[16rem] rounded-full bg-[rgba(248,219,230,0.28)] blur-[100px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[var(--layout-max)] px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
          {isWizardFlow ? <AccessCodeWizardSteps /> : null}
          <AccessCodeHero backHref={backHref} />

          {loading ? <AccessCodeLoadingSkeleton /> : null}
          {!loading && error ? <AccessCodeError message={error} /> : null}

          {!loading && detail ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
              <AccessCodeCardPreview detail={detail} />
              <AccessCodeFormPanel
                accessMode={accessMode}
                setAccessMode={setAccessMode}
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
