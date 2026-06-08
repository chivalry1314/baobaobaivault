export type ShareUserRole = "viewer" | "creator" | "manager";
export type ShareReviewStatus = "unsubmitted" | "pending" | "approved" | "rejected";
export type ShareCardAccessMode = "free" | "paid";

export type ExternalSessionUser = {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatar: string;
  bio: string;
  coverImage: string;
  phone: string;
  role: ShareUserRole;
  createdAt: string;
};

export type ShareUserRoleManageItem = {
  id: string;
  email: string;
  username: string;
  nickname: string;
  role: ShareUserRole;
  status: string;
  createdAt: string;
};

export type CardContentSlot = "system_theme" | "wechat_theme" | "app" | "character_persona" | "world_book";

export type CardAsset = {
  slot: CardContentSlot;
  originalFileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
};

export type PlatformCard = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  visibility: "private" | "public";
  status: "draft" | "published" | "archived";
  accessMode: ShareCardAccessMode;
  reviewStatus: ShareReviewStatus;
  reviewReason: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  originalFileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
  categories: CardContentSlot[];
  createdAt: string;
  updatedAt: string;
};

export type CardStats = {
  downloadCount: number;
  lastDownloadedAt: string | null;
};

export type PublicCreator = {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
};

export type DiscoverCardItem = {
  card: PlatformCard;
  creator: PublicCreator;
  stats: CardStats;
};

export type DiscoverCardsPagination = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type SessionResponse = {
  authenticated: boolean;
  user: ExternalSessionUser | null;
};

export type ContinueAuthResponse = {
  ok: true;
  created: boolean;
  user: ExternalSessionUser;
};

export type AuthResponse = {
  ok: true;
  user: ExternalSessionUser;
};

export type RegisterResponse = {
  ok: true;
  user?: ExternalSessionUser;
  verificationRequired: boolean;
  email?: string;
  expiresIn?: number;
};

export type RegisterVerifyResponse = {
  ok: true;
  user: ExternalSessionUser;
};

export type RegisterResendResponse = {
  ok: true;
  email: string;
  expiresIn: number;
};

export type ShareAuthConfig = {
  emailVerificationEnabled: boolean;
  verificationCodeTTLSeconds: number;
  resendIntervalSeconds: number;
};

export type ShareAuthSettings = {
  emailVerificationEnabled: boolean;
  verificationCodeTTLSeconds: number;
  resendIntervalSeconds: number;
  maxVerifyAttempts: number;
  canUpdate: boolean;
};

export type ShareAuthConfigResponse = {
  ok: true;
  config: ShareAuthConfig;
};

export type ShareAuthSettingsResponse = {
  ok: true;
  settings: ShareAuthSettings;
};

export type ShareEmailHealth = {
  enabled: boolean;
  emailVerificationEnabled: boolean;
  fromAddress: string;
  smtpHost: string;
  smtpPort: number;
};

export type ShareEmailHealthResponse = {
  ok: true;
  health: ShareEmailHealth;
};

export type ShareSMTPTestResponse = {
  ok: true;
  targetEmail: string;
};

export type ShareSMTPTestRequest = {
  targetEmail: string;
};

export type DashboardCard = {
  card: PlatformCard;
  stats: CardStats;
  hasAccessCode: boolean;
  accessCode?: string;
};

export type DashboardStats = {
  totalCards: number;
  totalPublic: number;
  totalDownloads: number;
};

export type DashboardResponse = {
  user: ExternalSessionUser;
  cards: DashboardCard[];
  stats: DashboardStats;
};

export type AccessCodeDashboardItem = {
  card: PlatformCard;
  stats: CardStats;
  config: CardAccessCodeConfig;
  isPubliclyVisible: boolean;
};

export type AccessCodeDashboardResponse = {
  user: ExternalSessionUser;
  items: AccessCodeDashboardItem[];
  availableCards: PlatformCard[];
};

export type ReviewDashboardItem = {
  card: PlatformCard;
  creator: PublicCreator;
  submittedAt?: string | null;
};

export type ReviewDashboardResponse = {
  items: ReviewDashboardItem[];
};

export type CardDetailResponse = {
  card: PlatformCard;
  creator: PublicCreator;
  stats: CardStats;
  assets: CardAsset[];
  canEdit: boolean;
  canDownload: boolean;
  accessCodeStatus?: "none" | "required" | "expired" | "exhausted";
};

export type CardAssetUpdateResponse = {
  card: PlatformCard;
  assets: CardAsset[];
};

export type CardAccessCodeConfig = {
  cardId: string;
  code: string;
  expiresAt: string | null;
  expireDays: number;
  usageLimit: number;
  usageCount: number;
  unlimited: boolean;
  isActive: boolean;
  isExpired: boolean;
};

export type ApiError = {
  error: string;
};
