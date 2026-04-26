import type {
  ApiError,
  BrowseResponse,
  CardRecord,
  DashboardResponse,
  DownloadCodeRecord,
  RedeemResult,
  SessionResponse,
  SessionUser,
  ShopMeta,
} from "@/lib/shared";

const API_ROOT = "/api/share/v1/shops";

function normalizeTenantCode(tenantCode: string) {
  return tenantCode.trim().toLowerCase();
}

function toErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorValue = (payload as ApiError).error;
    if (typeof errorValue === "string" && errorValue.trim()) {
      return errorValue;
    }
  }
  return fallback;
}

export class ShareApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ShareApiError";
    this.status = status;
    Object.setPrototypeOf(this, ShareApiError.prototype);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new ShareApiError(response.status, toErrorMessage(payload, `Request failed (${response.status})`));
  }

  return payload as T;
}

function shopBase(tenantCode: string) {
  return `${API_ROOT}/${encodeURIComponent(normalizeTenantCode(tenantCode))}`;
}

export const shareApi = {
  getShopMeta(tenantCode: string) {
    return request<ShopMeta>(`${shopBase(tenantCode)}/meta`);
  },

  listShopCards(tenantCode: string) {
    return request<BrowseResponse>(`${shopBase(tenantCode)}/cards`);
  },

  redeemCode(tenantCode: string, code: string) {
    return request<RedeemResult>(`${shopBase(tenantCode)}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
  },

  register(tenantCode: string, input: { username: string; displayName: string; password: string }) {
    return request<{ ok: true; user: SessionUser }>(`${shopBase(tenantCode)}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  login(tenantCode: string, input: { username: string; password: string }) {
    return request<{ ok: true; user: SessionUser }>(`${shopBase(tenantCode)}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  logout(tenantCode: string) {
    return request<{ ok: true }>(`${shopBase(tenantCode)}/auth/logout`, {
      method: "POST",
    });
  },

  session(tenantCode: string) {
    return request<SessionResponse>(`${shopBase(tenantCode)}/auth/session`);
  },

  creatorCards(tenantCode: string) {
    return request<DashboardResponse>(`${shopBase(tenantCode)}/creator/cards`);
  },

  createCard(
    tenantCode: string,
    input: {
      title: string;
      description: string;
      isPublic: boolean;
      file: File;
      maxUses: string;
      expiresAt: string;
    },
  ) {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("isPublic", String(input.isPublic));
    formData.append("file", input.file);

    if (input.maxUses.trim()) {
      formData.append("maxUses", input.maxUses.trim());
    }
    if (input.expiresAt.trim()) {
      formData.append("expiresAt", input.expiresAt.trim());
    }

    return request<{ card: CardRecord; code: DownloadCodeRecord }>(`${shopBase(tenantCode)}/creator/cards`, {
      method: "POST",
      body: formData,
    });
  },

  updateCard(
    tenantCode: string,
    cardId: string,
    input: { title: string; description: string; isPublic: boolean },
  ) {
    return request<{ card: CardRecord }>(`${shopBase(tenantCode)}/creator/cards/${encodeURIComponent(cardId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  deleteCard(tenantCode: string, cardId: string) {
    return request<{ ok: true }>(`${shopBase(tenantCode)}/creator/cards/${encodeURIComponent(cardId)}`, {
      method: "DELETE",
    });
  },

  createCode(
    tenantCode: string,
    input: { cardId: string; maxUses: number | null; expiresAt: string | null },
  ) {
    return request<{ card: CardRecord; code: DownloadCodeRecord }>(`${shopBase(tenantCode)}/creator/codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  browseCards(tenantCode: string) {
    return request<BrowseResponse>(`${shopBase(tenantCode)}/creator/browse`);
  },

  browseDownloadUrl(tenantCode: string, cardId: string) {
    return `${shopBase(tenantCode)}/creator/browse/download?cardId=${encodeURIComponent(cardId)}`;
  },
};
