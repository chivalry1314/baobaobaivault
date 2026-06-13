import { cookies } from "next/headers";

import type {
  CardDetailResponse,
  DiscoverCardItem,
  DiscoverCardsPagination,
  SessionResponse,
  ShareSiteBrandingSettingsResponse,
} from "@/lib/shared";
import { SHARE_SITE_BRANDING_CACHE_TAG } from "@/lib/site-branding-cache";

const backendOrigin =
  process.env.SHARE_BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

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

async function requestServer<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  },
): Promise<T> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(buildServerUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function getServerSession(): Promise<SessionResponse> {
  try {
    return await requestServer<SessionResponse>("/api/share/auth/session", {
      cache: "no-store",
    });
  } catch {
    return {
      authenticated: false,
      user: null,
    };
  }
}

export async function getServerDiscoverCards(input?: {
  page?: number;
  size?: number;
}) {
  const params = new URLSearchParams();
  if (input?.page && input.page > 0) {
    params.set("page", String(input.page));
  }
  if (input?.size && input.size > 0) {
    params.set("size", String(input.size));
  }

  const query = params.toString();
  const path = query
    ? `/api/share/discover/cards?${query}`
    : "/api/share/discover/cards";

  try {
    return await requestServer<{
      cards: DiscoverCardItem[];
      pagination: DiscoverCardsPagination;
    }>(path, {
      next: {
        revalidate: 60,
      },
    });
  } catch {
    return null;
  }
}

export async function getServerCardDetail(cardId: string) {
  try {
    return await requestServer<CardDetailResponse>(
      `/api/share/cards/${encodeURIComponent(cardId)}`,
      {
        cache: "no-store",
      },
    );
  } catch {
    return null;
  }
}

export async function getServerSiteBrandingSettings() {
  try {
    const response = await requestServer<ShareSiteBrandingSettingsResponse>(
      "/api/share/discover/site-branding",
      {
        next: {
          tags: [SHARE_SITE_BRANDING_CACHE_TAG],
        },
      },
    );
    return response.settings;
  } catch {
    return null;
  }
}
