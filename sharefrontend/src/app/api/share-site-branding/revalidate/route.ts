import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { SessionResponse } from "@/lib/shared";
import { SHARE_SITE_BRANDING_CACHE_TAG } from "@/lib/site-branding-cache";

const backendOrigin = process.env.SHARE_BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

function buildServerUrl(path: string) {
  return new URL(path, backendOrigin).toString();
}

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function POST() {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(buildServerUrl("/api/share/auth/session"), {
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const payload = (await response.json()) as SessionResponse;
  if (!payload.authenticated || !payload.user?.isConfiguredSuperAdmin) {
    return NextResponse.json({ error: "configured super admin required" }, { status: 403 });
  }

  revalidateTag(SHARE_SITE_BRANDING_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/login");
  revalidatePath("/system/site-branding");
  return NextResponse.json({ ok: true });
}
