import type {
  AccessCodeDashboardResponse,
  ApiError,
  CardAccessCodeConfig,
  CardDetailResponse,
  ContinueAuthResponse,
  DashboardResponse,
  DiscoverCardItem,
  ExternalSessionUser,
  PlatformCard,
  SessionResponse,
} from "@/lib/shared";

const API_ROOT = "/api/share";

const shareApiErrorMessages: Record<string, string> = {
  "invalid email": "邮箱格式不正确",
  "password must be at least 6 characters": "密码至少需要 6 位",
  "invalid email or password": "邮箱或密码不正确",
  "invalid request body": "请求参数不正确",
  "email already registered": "该邮箱已经注册",
  "nickname must be between 2 and 40 characters": "昵称需要 2 到 40 个字符",
  "bio must be at most 100 characters": "个人简介不能超过 100 个字",
  "phone format is invalid": "手机号格式不正确",
  "current password is incorrect": "当前密码不正确",
  "invalid image data": "图片数据不正确，请重新上传",
  "image exceeds 5mb": "图片大小不能超过 5MB",
  "invalid access code": "提取码不正确",
  "invalid access code rules": "提取码规则不正确",
  "access code required": "请输入提取码",
  "access code expired": "当前提取码已过期",
  "access code exhausted": "当前提取码已达使用上限",
};

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

export function getShareErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
  return shareApiErrorMessages[message.toLowerCase()] ?? message;
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

export const shareApi = {
  continueAuth(input: { email: string; password: string }) {
    return request<ContinueAuthResponse>(`${API_ROOT}/auth/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  register(input: { email: string; nickname: string; password: string }) {
    return request<{ ok: true; user: ExternalSessionUser }>(`${API_ROOT}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<{ ok: true; user: ExternalSessionUser }>(`${API_ROOT}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  logout() {
    return request<{ ok: true }>(`${API_ROOT}/auth/logout`, {
      method: "POST",
    });
  },

  session() {
    return request<SessionResponse>(`${API_ROOT}/auth/session`);
  },

  updateProfile(input: {
    nickname: string;
    avatar: string;
    bio: string;
    coverImage: string;
    phone: string;
  }) {
    return request<{ ok: true; user: ExternalSessionUser }>(`${API_ROOT}/me/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  changePassword(input: {
    oldPassword: string;
    newPassword: string;
  }) {
    return request<{ ok: true }>(`${API_ROOT}/me/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  discoverCards() {
    return request<{ cards: DiscoverCardItem[] }>(`${API_ROOT}/discover/cards`);
  },

  cardDetail(cardId: string) {
    return request<CardDetailResponse>(`${API_ROOT}/cards/${encodeURIComponent(cardId)}`);
  },

  myCards() {
    return request<DashboardResponse>(`${API_ROOT}/me/cards`);
  },

  myAccessCodes() {
    return request<AccessCodeDashboardResponse>(`${API_ROOT}/me/access-codes`);
  },

  createCard(input: {
    title: string;
    description: string;
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    file: File;
  }) {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("visibility", input.visibility);
    formData.append("status", input.status);
    formData.append("file", input.file);

    return request<{ card: PlatformCard }>(`${API_ROOT}/me/cards`, {
      method: "POST",
      body: formData,
    });
  },

  updateCard(
    cardId: string,
    input: {
      title: string;
      description: string;
      visibility: "private" | "public";
      status: "draft" | "published" | "archived";
    },
  ) {
    return request<{ card: PlatformCard }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  cardAccessCode(cardId: string) {
    return request<{ config: CardAccessCodeConfig }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/access-code`);
  },

  updateCardAccessCode(
    cardId: string,
    input: {
      code: string;
      expireDays: number;
      usageLimit: number;
      unlimited: boolean;
    },
  ) {
    return request<{ config: CardAccessCodeConfig }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/access-code`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  deleteCardAccessCode(cardId: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/access-code`, {
      method: "DELETE",
    });
  },

  deleteCard(cardId: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}`, {
      method: "DELETE",
    });
  },
};
