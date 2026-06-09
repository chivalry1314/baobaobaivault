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
  isConfiguredSuperAdmin: boolean;
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

export type ShareUsersManageResponse = {
  users: ShareUserRoleManageItem[];
  pagination: SharePagination;
};

export type ShareSystemRolesResponse = {
  items: ShareSystemRole[];
  pagination: SharePagination;
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

export type ShareMediaStorageSettings = {
  storageMode: "local" | "object_storage";
  localFallbackEnabled: boolean;
  coverNamespaceID: string;
  assetNamespaceID: string;
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

export type ShareMediaStorageSettingsResponse = {
  ok: true;
  settings: ShareMediaStorageSettings;
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

export type ShareStorageConfig = {
  id: string;
  owner_user_id?: string | null;
  name: string;
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  path_style: boolean;
  is_default: boolean;
  status: string;
  extra_config: string;
  used_storage: number;
  object_count: number;
  created_at: string;
  updated_at: string;
};

export type ShareNamespace = {
  id: string;
  owner_user_id?: string | null;
  name: string;
  description: string;
  status: string;
  is_default: boolean;
  storage_config_id?: string | null;
  path_prefix: string;
  max_storage?: number | null;
  max_files?: number | null;
  max_file_size?: number | null;
  used_storage: number;
  used_files: number;
  created_at: string;
  updated_at: string;
  storage_config?: ShareStorageConfig | null;
};

export type SharePagination = {
  total: number;
  page: number;
  pageSize: number;
};

export type ShareStorageObject = {
  id: string;
  namespace_id: string;
  key: string;
  name: string;
  size: number;
  content_type: string;
  etag: string;
  version_id: string;
  storage_key: string;
  metadata: string;
  is_latest: boolean;
  last_modified: string;
  created_at: string;
  updated_at: string;
};

export type ShareObjectVersion = {
  id: string;
  object_id: string;
  version_id: string;
  size: number;
  etag: string;
  storage_key: string;
  is_latest: boolean;
  created_at: string;
};

export type SharePreparedPresignPut = {
  url: string;
  key: string;
  version_id: string;
  storage_key: string;
};

export type ShareAuditLog = {
  id: string;
  user_id?: string | null;
  action: string;
  resource: string;
  resource_id: string;
  detail: string;
  ip_address: string;
  user_agent: string;
  status: string;
  created_at: string;
};

export type ShareAccessKeyItem = {
  id: string;
  user_id?: string | null;
  access_key: string;
  description: string;
  status: string;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type ShareSystemAccessKeyCreateResult = {
  id: string;
  access_key: string;
  secret_key: string;
  description: string;
  status: string;
  expires_at?: string | null;
  created_at: string;
};

export type ShareSystemAccessKeyOwner = {
  id: string;
  email: string;
  username: string;
  nickname: string;
};

export type SharePermission = {
  id: string;
  code: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
};

export type ShareSystemRole = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  level: number;
  created_at: string;
  updated_at: string;
  permissions?: SharePermission[];
  namespaces?: ShareNamespace[];
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
