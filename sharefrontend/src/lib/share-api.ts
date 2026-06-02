import type {
  AccessCodeDashboardResponse,
  ApiError,
  AuthResponse,
  CardAccessCodeConfig,
  CardAssetUpdateResponse,
  CardContentSlot,
  CardDetailResponse,
  ContinueAuthResponse,
  DashboardResponse,
  DiscoverCardItem,
  DiscoverCardsPagination,
  ExternalSessionUser,
  PlatformCard,
  ReviewDashboardResponse,
  SessionResponse,
  ShareCardAccessMode,
  ShareUserRole,
  ShareUserRoleManageItem,
} from "@/lib/shared";

const API_ROOT = "/api/share";

const shareApiErrorMessages: Record<string, string> = {
  "invalid email": "邮箱格式不正确",
  "password must be at least 6 characters": "密码长度至少 6 位",
  "invalid email or password": "邮箱或密码不正确",
  "invalid request body": "请求参数不正确",
  "email already registered": "该邮箱已注册",
  "nickname must be between 2 and 40 characters": "昵称长度需要在 2 到 40 个字符之间",
  "bio must be at most 100 characters": "个人简介不能超过 100 个字符",
  "phone format is invalid": "手机号格式不正确",
  "current password is incorrect": "当前密码不正确",
  "invalid image data": "图片数据不正确，请重新上传",
  "image exceeds 5mb": "图片大小不能超过 5MB",
  "invalid access code": "提取码不正确",
  "invalid access code rules": "提取码规则不正确",
  "access code required": "请输入提取码",
  "access code expired": "当前提取码已过期",
  "access code exhausted": "当前提取码已达到使用上限",
  "manager role required": "需要管理员权限",
  "manager or creator role required": "需要创作者或管理员权限",
  "invalid user role": "用户角色不正确",
  "cannot downgrade your own role": "不能降低自己的管理员权限",
  "invalid card content slot": "分类槽位不正确",
  "invalid card access mode": "卡片状态不正确",
  "paid access mode required": "请先把卡片切换为付费模式后再保存提取码",
  "card must keep at least one category file": "卡片至少保留一个分类文件",
  "invalid review status": "审核状态不正确",
  "review reason is required": "驳回时必须填写原因",
  "card not found": "卡片不存在",
  "card access denied": "没有该卡片权限",
  "user not found": "用户不存在",
  "authentication required": "请先登录",
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
    return request<AuthResponse>(`${API_ROOT}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResponse>(`${API_ROOT}/auth/login`, {
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
    return request<SessionResponse>(`${API_ROOT}/auth/session`, {
      cache: "no-store",
    });
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

  discoverCards(input?: { page?: number; size?: number }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.size && input.size > 0) {
      params.set("size", String(input.size));
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/discover/cards?${query}` : `${API_ROOT}/discover/cards`;
    return request<{ cards: DiscoverCardItem[]; pagination: DiscoverCardsPagination }>(path);
  },

  cardDetail(cardId: string) {
    return request<CardDetailResponse>(
      `${API_ROOT}/cards/${encodeURIComponent(cardId)}`,
      {
        cache: "no-store",
      },
    );
  },

  myCards() {
    return request<DashboardResponse>(`${API_ROOT}/me/cards`, {
      cache: "no-store",
    });
  },

  myAccessCodes() {
    return request<AccessCodeDashboardResponse>(`${API_ROOT}/me/access-codes`, {
      cache: "no-store",
    });
  },

  createCard(input: {
    title: string;
    description: string;
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    accessMode: ShareCardAccessMode;
    file: File;
    cover?: File;
  }) {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("visibility", input.visibility);
    formData.append("status", input.status);
    formData.append("accessMode", input.accessMode);
    formData.append("file", input.file);
    if (input.cover) {
      formData.append("cover", input.cover);
    }

    return request<{ card: PlatformCard }>(`${API_ROOT}/me/cards`, {
      method: "POST",
      body: formData,
    });
  },

  createCardBundle(input: {
    title: string;
    description: string;
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    accessMode: ShareCardAccessMode;
    cover?: File;
    items: Array<{
      slot: CardContentSlot;
      file: File;
    }>;
  }) {
    const formData = new FormData();
    const payload = {
      title: input.title,
      description: input.description,
      visibility: input.visibility,
      status: input.status,
      accessMode: input.accessMode,
      items: input.items.map((item, index) => ({
        slot: item.slot,
        fileField: `file_${index}`,
      })),
    };

    formData.append("payload", JSON.stringify(payload));
    if (input.cover) {
      formData.append("cover", input.cover);
    }
    input.items.forEach((item, index) => {
      formData.append(`file_${index}`, item.file);
    });

    return request<{ card: PlatformCard }>(`${API_ROOT}/me/admin/cards`, {
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
      accessMode?: ShareCardAccessMode;
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

  replaceCardAsset(cardId: string, slot: CardContentSlot, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request<CardAssetUpdateResponse>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/assets/${encodeURIComponent(slot)}`,
      {
        method: "PUT",
        body: formData,
      },
    );
  },

  replaceCardCover(cardId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request<CardAssetUpdateResponse>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/cover`, {
      method: "PUT",
      body: formData,
    });
  },

  deleteCardAsset(cardId: string, slot: CardContentSlot) {
    return request<CardAssetUpdateResponse>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/assets/${encodeURIComponent(slot)}`,
      {
        method: "DELETE",
      },
    );
  },

  deleteCardCover(cardId: string) {
    return request<CardAssetUpdateResponse>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/cover`, {
      method: "DELETE",
    });
  },

  submitCardReview(cardId: string) {
    return request<{ card: PlatformCard }>(`${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/submit-review`, {
      method: "POST",
    });
  },

  adminUsers() {
    return request<{ users: ShareUserRoleManageItem[] }>(
      `${API_ROOT}/me/admin/users`,
      {
        cache: "no-store",
      },
    );
  },

  updateUserRole(userId: string, role: ShareUserRole) {
    return request<{ user: ExternalSessionUser }>(`${API_ROOT}/me/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });
  },

  adminReviews(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<ReviewDashboardResponse>(
      `${API_ROOT}/me/admin/reviews${query}`,
      {
        cache: "no-store",
      },
    );
  },

  adminApproveReview(cardId: string) {
    return request<{ card: PlatformCard }>(`${API_ROOT}/me/admin/reviews/${encodeURIComponent(cardId)}/approve`, {
      method: "POST",
    });
  },

  adminRejectReview(cardId: string, reason: string) {
    return request<{ card: PlatformCard }>(`${API_ROOT}/me/admin/reviews/${encodeURIComponent(cardId)}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });
  },

  cardAccessCode(cardId: string) {
    return request<{ config: CardAccessCodeConfig }>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/access-code`,
      {
        cache: "no-store",
      },
    );
  },

  updateCardAccessCode(
    cardId: string,
    input: {
      accessMode?: ShareCardAccessMode;
      visibility?: "private" | "public";
      status?: "draft" | "published" | "archived";
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
