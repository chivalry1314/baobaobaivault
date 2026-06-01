"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { normalizeNextPath } from "@/components/share/auth-redirect/helpers";
import type { AuthRedirectProps } from "@/components/share/auth-redirect/types";

export function AuthRedirect({ nextPath = "/creator" }: AuthRedirectProps) {
  const normalizedNextPath = normalizeNextPath(nextPath);
  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(normalizedNextPath)}`,
    [normalizedNextPath],
  );

  useEffect(() => {
    window.location.replace(loginHref);
  }, [loginHref]);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl rounded-[32px] border-[4px] border-[var(--outline)] bg-white px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
        <p className="text-lg">正在跳转到登录页...</p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
        >
          立即登录
        </Link>
      </div>
    </div>
  );
}
