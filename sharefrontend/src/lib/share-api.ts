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
  DiscoverDesktopComponentItem,
  DiscoverSystemThemeItem,
  FavoritesResponse,
  ExternalSessionUser,
  PlatformCard,
  RegisterResendResponse,
  RegisterResponse,
  RegisterVerifyResponse,
  PasswordResetCompleteResponse,
  PasswordResetRequestResponse,
  PasswordResetResendResponse,
  ReviewDashboardResponse,
  ShareAuthConfigResponse,
  ShareAuthSettingsResponse,
  ShareAuditLog,
  ShareEmailHealthResponse,
  ShareMediaStorageSettingsResponse,
  SharePublicMediaStorageSettingsResponse,
  ShareSiteBrandingSettingsResponse,
  SessionResponse,
  ShareCardAccessMode,
  ShareMediaStorageMigrationRunResponse,
  ShareSMTPTestResponse,
  ShareNamespace,
  ShareObjectVersion,
  SharePagination,
  SharePermission,
  SharePreparedPresignPut,
  SharePreparedCardBundleUpload,
  ShareUploadedAssetInfo,
  ShareUploadedMediaInfo,
  SharePresignedUploadEntry,
  ShareSystemRole,
  ShareStorageConfig,
  ShareStorageObject,
  ShareSMTPTestRequest,
  ShareSystemRolesResponse,
  ShareUserRole,
  ShareUsersManageResponse,
  ShareAdminResetPasswordResponse,
} from "@/lib/shared";

const API_ROOT = "/api/share";

const shareApiErrorMessages: Record<string, string> = {
  "invalid email": "邮箱格式不正确",
  "password must be at least 6 characters": "密码长度至少 6 位",
  "invalid email or password": "邮箱或密码不正确",
  "invalid request body": "请求参数不正确",
  "email already registered": "该邮箱已注册",
  "email not verified": "该邮箱尚未完成邮箱验证",
  "nickname must be between 2 and 40 characters": "昵称长度需要在 2 到 40 个字符之间",
  "verification code expired": "验证码已过期，请重新获取",
  "invalid verification code": "验证码不正确",
  "verification required": "请先完成邮箱验证",
  "too many verification attempts": "验证码输入次数过多，请重新获取",
  "verification requested too frequently": "验证码发送过于频繁，请稍后再试",
  "smtp test requested too frequently": "测试邮件发送过于频繁，请稍后再试",
  "bio must be at most 100 characters": "个人简介不能超过 100 个字符",
  "phone format is invalid": "手机号格式不正确",
  "current password is incorrect": "当前密码不正确",
  "account self deleted": "账号已注销",
  "invalid image data": "图片数据不正确，请重新上传",
  "image exceeds 5mb": "图片大小不能超过 5MB",
  "invalid access code": "提取码不正确",
  "invalid access code rules": "提取码规则不正确",
  "access code required": "请输入提取码",
  "access code expired": "当前提取码已过期",
  "access code exhausted": "当前提取码已达到使用上限",
  "manager role required": "需要管理员权限",
  "configured super admin required": "只有系统初始化超级管理员可以修改",
  "namespace_id and key are required": "命名空间和对象 Key 不能为空",
  "namespace id is required": "命名空间不能为空",
  "cover_namespace_id and asset_namespace_id are required": "启用对象存储时，封面和附件命名空间都必须配置",
  "share media storage mode must be object_storage": "只有切换到对象存储模式后，才能迁移历史本地文件",
  "object storage service is unavailable": "后端对象存储服务当前不可用，请检查服务配置",
  "namespace not found": "所选命名空间不存在或已被删除",
  "name is required": "名称不能为空",
  "provider is required": "存储类型不能为空",
  "bucket is required": "Bucket 不能为空",
  "storage config not found": "存储配置不存在",
  "storage config is in use by namespaces": "该存储配置已被命名空间使用，不能直接删除",
  "namespace name already exists": "命名空间名称已存在",
  "namespace is not empty, please delete objects first": "命名空间不为空，请先删除对象后再删除命名空间",
  "max_storage must be greater than 0": "最大存储空间必须大于 0",
  "max_files must be greater than 0": "最大文件数必须大于 0",
  "max_file_size must be greater than 0": "单文件最大大小必须大于 0",
  "namespace max file size exceeded": "文件大小超过命名空间限制",
  "namespace storage quota exceeded": "命名空间存储空间不足",
  "namespace max files quota exceeded": "命名空间文件数量已达上限",
  "file is required": "请先选择上传文件",
  "object key is required": "对象 Key 不能为空",
  "object not found": "对象不存在",
  "target version not found": "目标版本不存在",
  "version_id is required": "版本号不能为空",
  "invalid from": "开始时间格式不正确",
  "invalid to": "结束时间格式不正确",
  "id is required": "密钥 ID 不能为空",
  "server.admin_email is not configured": "未配置系统超级管理员邮箱",
  "manager or creator role required": "需要创作者或管理员权限",
  "invalid user role": "用户角色不正确",
  "code and name are required": "角色编码和名称不能为空",
  "role code already exists": "角色编码已存在",
  "admin role can not be created manually": "管理员角色不能手动创建",
  "admin role can not be modified": "管理员角色不能修改",
  "admin role can not be deleted": "管理员角色不能删除",
  "system role can not be modified": "系统角色不能修改",
  "system role can not be deleted": "系统角色不能删除",
  "role name can not be empty": "角色名称不能为空",
  "some permission_ids are invalid": "存在无效的权限项",
  "some namespace_ids are invalid": "存在无效的命名空间",
  "role is assigned to users, unbind users first": "该角色已绑定用户，请先解除绑定",
  "role not found": "角色不存在",
  "role id is required": "角色 ID 不能为空",
  "system role can not be created": "统一后的角色体系不支持新增自定义角色",
  "invalid verification code ttl": "验证码有效期需要在 300 到 1800 秒之间",
  "invalid resend interval": "重发间隔需要在 30 到 300 秒之间",
  "invalid max verify attempts": "最大验证次数需要在 3 到 10 次之间",
  "resend interval must be shorter than verification code ttl": "重发间隔必须小于验证码有效期",
  "email verification requires email service configuration": "开启邮箱验证前请先完成 SMTP 配置",
  "admin password reset unavailable": "当前未开启邮箱验证，请联系管理员重置密码",
  "cannot downgrade your own role": "不能降低自己的管理员权限",
  "invalid card content slot": "分类槽位不正确",
  "invalid card access mode": "卡片状态不正确",
  "paid access mode required": "请先把卡片切换为需提取码模式后再保存提取码",
  "card must keep at least one category file": "卡片至少保留一个分类文件",
  "invalid system theme package": "系统主题包无法按 baobaobaiphone 当前解析规则导入，请检查 zip/json 结构、manifest 和资源路径",
  "system theme package exceeds 20mb": "系统主题包不能超过 20MB",
  "invalid desktop component file": "桌面组件文件不是有效的 HTML，请检查文件内容",
  "desktop component file exceeds 2mb": "桌面组件文件不能超过 2MB",
  "invalid review status": "审核状态不正确",
  "review reason is required": "驳回时必须填写原因",
  "card not found": "卡片不存在",
  "card access denied": "没有该卡片权限",
  "user not found": "用户不存在",
  "cannot delete your own account": "不能注销自己的账号",
  "cannot delete the last manager account": "至少需要保留一个管理员账号",
  "cannot delete configured super admin account": "系统初始化超级管理员不能注销",
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

async function requestBlob(path: string, options?: RequestInit): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    throw new ShareApiError(response.status, toErrorMessage(payload, `Request failed (${response.status})`));
  }

  const disposition = response.headers.get("content-disposition") || "";
  const matched = disposition.match(/filename="?([^"]+)"?/i);
  const filename = matched?.[1]?.trim() || "download.bin";

  return {
    blob: await response.blob(),
    filename,
  };
}

export const shareApi = {
  revalidateSiteBrandingCache() {
    return request<{ ok: true }>("/api/share-site-branding/revalidate", {
      method: "POST",
    });
  },

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
    return request<RegisterResponse>(`${API_ROOT}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  verifyRegisterCode(input: { email: string; code: string }) {
    return request<RegisterVerifyResponse>(`${API_ROOT}/auth/register/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  resendRegisterCode(input: { email: string }) {
    return request<RegisterResendResponse>(`${API_ROOT}/auth/register/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  requestPasswordReset(input: { email: string }) {
    return request<PasswordResetRequestResponse>(`${API_ROOT}/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  resendPasswordResetCode(input: { email: string }) {
    return request<PasswordResetResendResponse>(`${API_ROOT}/auth/password-reset/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  completePasswordReset(input: { email: string; code: string; newPassword: string }) {
    return request<PasswordResetCompleteResponse>(`${API_ROOT}/auth/password-reset/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  authConfig() {
    return request<ShareAuthConfigResponse>(`${API_ROOT}/auth/config`, {
      cache: "no-store",
    });
  },

  emailHealth() {
    return request<ShareEmailHealthResponse>(`${API_ROOT}/auth/email-health`, {
      cache: "no-store",
    });
  },

  sendSMTPTestEmail(input: { targetEmail: string }) {
    return request<ShareSMTPTestResponse>(`${API_ROOT}/auth/email-health/test`, {
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

  deleteOwnAccount(input: { oldPassword: string }) {
    return request<{ ok: true }>(`${API_ROOT}/me/account`, {
      method: "DELETE",
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

  discoverSystemThemes(input?: { page?: number; size?: number }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.size && input.size > 0) {
      params.set("size", String(input.size));
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/discover/system-themes?${query}` : `${API_ROOT}/discover/system-themes`;
    return request<{ items: DiscoverSystemThemeItem[]; pagination: DiscoverCardsPagination }>(path);
  },

  discoverDesktopComponents(input?: { page?: number; size?: number }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.size && input.size > 0) {
      params.set("size", String(input.size));
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/discover/desktop-components?${query}` : `${API_ROOT}/discover/desktop-components`;
    return request<{ items: DiscoverDesktopComponentItem[]; pagination: DiscoverCardsPagination }>(path);
  },

  favoriteCard(cardId: string) {
    return request<{ ok: true }>(
      `${API_ROOT}/me/favorites/${encodeURIComponent(cardId)}`,
      {
        method: "POST",
      },
    );
  },

  unfavoriteCard(cardId: string) {
    return request<{ ok: true }>(
      `${API_ROOT}/me/favorites/${encodeURIComponent(cardId)}`,
      {
        method: "DELETE",
      },
    );
  },

  myFavorites(input?: { page?: number; size?: number }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.size && input.size > 0) {
      params.set("size", String(input.size));
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/me/favorites?${query}` : `${API_ROOT}/me/favorites`;
    return request<FavoritesResponse>(path, {
      cache: "no-store",
    });
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
    tags: string[];
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    accessMode: ShareCardAccessMode;
    file: File;
    cover?: File;
  }) {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("tags", JSON.stringify(input.tags));
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
    tags: string[];
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
      tags: input.tags,
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

  presignCardBundle(input: {
    title: string;
    description: string;
    tags: string[];
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    accessMode: ShareCardAccessMode;
    cover?: { contentType: string; size: number };
    assets: Array<{ slot: CardContentSlot; contentType: string; size: number }>;
  }) {
    return request<SharePreparedCardBundleUpload>(`${API_ROOT}/me/admin/cards/presign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        tags: input.tags,
        visibility: input.visibility,
        status: input.status,
        access_mode: input.accessMode,
        cover_content_type: input.cover?.contentType,
        cover_size: input.cover?.size,
        assets: input.assets.map((a) => ({ slot: a.slot, content_type: a.contentType, size: a.size })),
      }),
    });
  },

  completeCardBundle(input: {
    cardId: string;
    title: string;
    description: string;
    tags: string[];
    visibility: "private" | "public";
    status: "draft" | "published" | "archived";
    accessMode: ShareCardAccessMode;
    cover?: ShareUploadedMediaInfo;
    assets: ShareUploadedAssetInfo[];
  }) {
    return request<{ card: PlatformCard }>(`${API_ROOT}/me/admin/cards/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card_id: input.cardId,
        title: input.title,
        description: input.description,
        tags: input.tags,
        visibility: input.visibility,
        status: input.status,
        access_mode: input.accessMode,
        cover: input.cover,
        assets: input.assets,
      }),
    });
  },

  updateCard(
    cardId: string,
    input: {
      title: string;
      description: string;
      tags: string[];
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

  presignCardCoverReplace(cardId: string, contentType: string, size: number) {
    return request<SharePresignedUploadEntry>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/cover/presign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content_type: contentType, size }),
      },
    );
  },

  completeCardCoverReplace(
    cardId: string,
    media: ShareUploadedMediaInfo,
  ) {
    return request<CardAssetUpdateResponse>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/cover/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(media),
      },
    );
  },

  presignCardAssetReplace(cardId: string, slot: CardContentSlot, contentType: string, size: number) {
    return request<SharePresignedUploadEntry>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/assets/${encodeURIComponent(slot)}/presign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content_type: contentType, size }),
      },
    );
  },

  completeCardAssetReplace(
    cardId: string,
    slot: CardContentSlot,
    media: ShareUploadedMediaInfo,
  ) {
    return request<CardAssetUpdateResponse>(
      `${API_ROOT}/me/cards/${encodeURIComponent(cardId)}/assets/${encodeURIComponent(slot)}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(media),
      },
    );
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

  systemStorageConfigs() {
    return request<{ items: ShareStorageConfig[] }>(`${API_ROOT}/me/system/storage/configs`, {
      cache: "no-store",
    });
  },

  createSystemStorageConfig(input: {
    owner_user_id?: string;
    name: string;
    provider: string;
    endpoint: string;
    region: string;
    bucket: string;
    access_key: string;
    secret_key: string;
    path_style: boolean;
    is_default: boolean;
    extra_config: string;
  }) {
    return request<{ item: ShareStorageConfig }>(`${API_ROOT}/me/system/storage/configs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  systemStorageConfig(id: string) {
    return request<{ item: ShareStorageConfig }>(`${API_ROOT}/me/system/storage/configs/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  },

  updateSystemStorageConfig(id: string, input: {
    owner_user_id?: string | null;
    name: string;
    provider: string;
    endpoint: string;
    region: string;
    bucket: string;
    access_key?: string;
    secret_key?: string;
    path_style: boolean;
    is_default: boolean;
    extra_config: string;
  }) {
    return request<{ item: ShareStorageConfig }>(`${API_ROOT}/me/system/storage/configs/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  deleteSystemStorageConfig(id: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/system/storage/configs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  systemNamespaces(input?: { page?: number; pageSize?: number; status?: string }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }
    if (input?.status) {
      params.set("status", input.status);
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/me/system/namespaces?${query}` : `${API_ROOT}/me/system/namespaces`;
    return request<{
      items: ShareNamespace[];
      pagination: { total: number; page: number; pageSize: number };
    }>(path, {
      cache: "no-store",
    });
  },

  systemNamespace(id: string) {
    return request<{ item: ShareNamespace }>(`${API_ROOT}/me/system/namespaces/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  },

  createSystemNamespace(input: {
    name: string;
    description: string;
    storage_config_id?: string;
    path_prefix?: string;
    max_storage?: number;
    max_files?: number;
    max_file_size?: number;
  }) {
    return request<{ item: ShareNamespace }>(`${API_ROOT}/me/system/namespaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  updateSystemNamespace(id: string, input: {
    name?: string;
    description?: string;
    status?: string;
    storage_config_id?: string;
    path_prefix?: string;
    max_storage?: number;
    max_files?: number;
    max_file_size?: number;
  }) {
    return request<{ item: ShareNamespace }>(`${API_ROOT}/me/system/namespaces/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  deleteSystemNamespace(id: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/system/namespaces/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  systemObjects(input: { namespaceID: string; prefix?: string; page?: number; pageSize?: number }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    if (input.prefix) {
      params.set("prefix", input.prefix);
    }
    if (input.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }
    return request<{ total: number; page: number; page_size: number; items: ShareStorageObject[] }>(
      `${API_ROOT}/me/system/objects?${params.toString()}`,
      {
        cache: "no-store",
      },
    ).then((response) => ({
      items: response.items || [],
      total: response.total || 0,
      page: response.page || 1,
      pageSize: response.page_size || input.pageSize || 20,
    }) satisfies SharePagination & { items: ShareStorageObject[] });
  },

  systemObjectVersions(input: { namespaceID: string; key: string; page?: number; pageSize?: number }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    params.set("key", input.key);
    if (input.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }
    return request<{ total: number; page: number; page_size: number; items: ShareObjectVersion[] }>(
      `${API_ROOT}/me/system/objects/versions?${params.toString()}`,
      {
        cache: "no-store",
      },
    ).then((response) => ({
      items: response.items || [],
      total: response.total || 0,
      page: response.page || 1,
      pageSize: response.page_size || input.pageSize || 20,
    }) satisfies SharePagination & { items: ShareObjectVersion[] });
  },

  createSystemObject(input: {
    namespaceID: string;
    key: string;
    file: File;
    contentType?: string;
    metadata?: string;
  }) {
    const formData = new FormData();
    formData.append("namespace_id", input.namespaceID);
    formData.append("key", input.key);
    formData.append("file", input.file);
    if (input.contentType) {
      formData.append("content_type", input.contentType);
    }
    if (input.metadata) {
      formData.append("metadata", input.metadata);
    }

    return request<{ data: ShareStorageObject }>(`${API_ROOT}/me/system/objects/upload`, {
      method: "POST",
      body: formData,
    });
  },

  deleteSystemObject(input: { namespaceID: string; key: string }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    params.set("key", input.key);
    return request<{ data: { deleted: boolean } }>(`${API_ROOT}/me/system/objects?${params.toString()}`, {
      method: "DELETE",
    });
  },

  downloadSystemObject(input: { namespaceID: string; key: string }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    params.set("key", input.key);
    return requestBlob(`${API_ROOT}/me/system/objects/download?${params.toString()}`);
  },

  rollbackSystemObjectVersion(input: { namespaceID: string; key: string; versionID: string }) {
    return request<{ data: ShareStorageObject }>(`${API_ROOT}/me/system/objects/versions/rollback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace_id: input.namespaceID,
        key: input.key,
        version_id: input.versionID,
      }),
    });
  },

  systemPresignPutObject(input: { namespaceID: string; key: string; ttlSeconds?: number }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    params.set("key", input.key);
    if (input.ttlSeconds && input.ttlSeconds > 0) {
      params.set("ttl_seconds", String(input.ttlSeconds));
    }
    return request<{ data: SharePreparedPresignPut }>(
      `${API_ROOT}/me/system/objects/presign-put?${params.toString()}`,
    );
  },

  completeSystemPresignPutObject(input: {
    namespaceID: string;
    key: string;
    versionID: string;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    return request<{ data: ShareStorageObject }>(`${API_ROOT}/me/system/objects/presign-put/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace_id: input.namespaceID,
        key: input.key,
        version_id: input.versionID,
        content_type: input.contentType,
        metadata: input.metadata,
      }),
    });
  },

  systemPresignGetObject(input: { namespaceID: string; key: string; ttlSeconds?: number }) {
    const params = new URLSearchParams();
    params.set("namespace_id", input.namespaceID);
    params.set("key", input.key);
    if (input.ttlSeconds && input.ttlSeconds > 0) {
      params.set("ttl_seconds", String(input.ttlSeconds));
    }
    return request<{ data: { url: string } }>(
      `${API_ROOT}/me/system/objects/presign-get?${params.toString()}`,
    );
  },

  systemAuditLogs(input?: {
    action?: string;
    resource?: string;
    status?: string;
    userID?: string;
    resourceID?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    if (input?.action) {
      params.set("action", input.action);
    }
    if (input?.resource) {
      params.set("resource", input.resource);
    }
    if (input?.status) {
      params.set("status", input.status);
    }
    if (input?.userID) {
      params.set("user_id", input.userID);
    }
    if (input?.resourceID) {
      params.set("resource_id", input.resourceID);
    }
    if (input?.from) {
      params.set("from", input.from);
    }
    if (input?.to) {
      params.set("to", input.to);
    }
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }

    const query = params.toString();
    const path = query ? `${API_ROOT}/me/system/audit/logs?${query}` : `${API_ROOT}/me/system/audit/logs`;
    return request<{ total: number; page: number; page_size: number; items: ShareAuditLog[] }>(path, {
      cache: "no-store",
    }).then((response) => ({
      items: response.items || [],
      total: response.total || 0,
      page: response.page || 1,
      pageSize: response.page_size || input?.pageSize || 20,
    }) satisfies SharePagination & { items: ShareAuditLog[] });
  },

  systemPermissions() {
    return request<SharePermission[]>(`${API_ROOT}/me/system/permissions`, {
      cache: "no-store",
    });
  },

  systemRoles(input?: { page?: number; pageSize?: number; keyword?: string; scope?: "all" | "system" | "custom" }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }
    if (input?.keyword?.trim()) {
      params.set("keyword", input.keyword.trim());
    }
    if (input?.scope && input.scope !== "all") {
      params.set("scope", input.scope);
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/me/system/roles?${query}` : `${API_ROOT}/me/system/roles`;
    return request<ShareSystemRolesResponse>(path, {
      cache: "no-store",
    });
  },

  systemRole(id: string) {
    return request<{ item: ShareSystemRole }>(`${API_ROOT}/me/system/roles/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  },

  createSystemRole(input: {
    code: string;
    name: string;
    description: string;
    level: number;
    permission_ids: string[];
    namespace_ids: string[];
  }) {
    return request<{ item: ShareSystemRole }>(`${API_ROOT}/me/system/roles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  updateSystemRole(id: string, input: {
    name?: string;
    description?: string;
    level?: number;
    permission_ids?: string[];
    namespace_ids?: string[];
  }) {
    return request<{ item: ShareSystemRole }>(`${API_ROOT}/me/system/roles/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  deleteSystemRole(id: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/system/roles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  systemUsers(input?: { page?: number; pageSize?: number; keyword?: string; role?: ShareUserRole | "all" }) {
    const params = new URLSearchParams();
    if (input?.page && input.page > 0) {
      params.set("page", String(input.page));
    }
    if (input?.pageSize && input.pageSize > 0) {
      params.set("page_size", String(input.pageSize));
    }
    if (input?.keyword?.trim()) {
      params.set("keyword", input.keyword.trim());
    }
    if (input?.role && input.role !== "all") {
      params.set("role", input.role);
    }
    const query = params.toString();
    const path = query ? `${API_ROOT}/me/system/users?${query}` : `${API_ROOT}/me/system/users`;
    return request<ShareUsersManageResponse>(path, {
      cache: "no-store",
    });
  },

  updateSystemUserRole(userId: string, role: ShareUserRole) {
    return request<{ user: ExternalSessionUser }>(`${API_ROOT}/me/system/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });
  },

  deleteSystemUser(userId: string) {
    return request<{ ok: true }>(`${API_ROOT}/me/system/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  resetSystemUserPassword(userId: string) {
    return request<ShareAdminResetPasswordResponse>(
      `${API_ROOT}/me/system/users/${encodeURIComponent(userId)}/reset-password`,
      {
        method: "POST",
      },
    );
  },

  systemAuthSettings() {
    return request<ShareAuthSettingsResponse>(`${API_ROOT}/me/system/auth-settings`, {
      cache: "no-store",
    });
  },

  updateSystemAuthSettings(input: {
    emailVerificationEnabled: boolean;
    verificationCodeTTLSeconds: number;
    resendIntervalSeconds: number;
    maxVerifyAttempts: number;
  }) {
    return request<ShareAuthSettingsResponse>(`${API_ROOT}/me/system/auth-settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  sendSystemSMTPTestEmail(input: ShareSMTPTestRequest) {
    return request<ShareSMTPTestResponse>(`${API_ROOT}/me/system/auth-settings/test-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  systemMediaStorageSettings() {
    return request<ShareMediaStorageSettingsResponse>(`${API_ROOT}/me/system/media-storage`, {
      cache: "no-store",
    });
  },

  publicMediaStorageSettings() {
    return request<SharePublicMediaStorageSettingsResponse>(`${API_ROOT}/discover/media-storage`, {
      cache: "no-store",
    });
  },

  systemSiteBrandingSettings() {
    return request<ShareSiteBrandingSettingsResponse>(`${API_ROOT}/me/system/site-branding`, {
      cache: "no-store",
    });
  },

  publicSiteBrandingSettings() {
    return request<ShareSiteBrandingSettingsResponse>(`${API_ROOT}/discover/site-branding`, {
      cache: "no-store",
    });
  },

  updateSystemMediaStorageSettings(input: {
    storageMode: "local" | "object_storage";
    localFallbackEnabled: boolean;
    coverNamespaceID: string;
    assetNamespaceID: string;
  }) {
    return request<ShareMediaStorageSettingsResponse>(`${API_ROOT}/me/system/media-storage`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  updateSystemSiteBrandingSettings(input: {
    siteName: string;
    siteShortName: string;
    siteDescription: string;
    siteSubtitle: string;
    showSiteSubtitle: boolean;
    authSubtitle: string;
    showAuthSubtitle: boolean;
    logoText: string;
    logoBadgeText: string;
    logoImageSrc: string;
    logoOriginalFileName: string;
    logoMimeType: string;
    footerText: string;
    defaultDisplayName: string;
    defaultCreatorName: string;
    defaultCreatorHandle: string;
    defaultInitials: string;
    creatorTagline: string;
  }) {
    return request<ShareSiteBrandingSettingsResponse>(`${API_ROOT}/me/system/site-branding`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  uploadSystemSiteBrandingLogo(input: { file: File; contentType?: string }) {
    const formData = new FormData();
    formData.append("file", input.file);
    if (input.contentType?.trim()) {
      formData.append("content_type", input.contentType.trim());
    }
    return request<ShareSiteBrandingSettingsResponse>(`${API_ROOT}/me/system/site-branding/logo`, {
      method: "POST",
      body: formData,
    });
  },

  runSystemMediaStorageMigration(input: {
    batchSize: number;
    deleteLocal: boolean;
    includeMissing: boolean;
  }) {
    return request<ShareMediaStorageMigrationRunResponse>(`${API_ROOT}/me/system/media-storage/migrate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
};
