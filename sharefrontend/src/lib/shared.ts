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
  forcePasswordChange: boolean;
  createdAt: string;
};

export type ShareUserRoleManageItem = {
  id: string;
  email: string;
  username: string;
  nickname: string;
  role: ShareUserRole;
  status: string;
  forcePasswordChange: boolean;
  createdAt: string;
};

export type ShareUsersManageResponse = {
  users: ShareUserRoleManageItem[];
  pagination: SharePagination;
};

export type ShareAdminResetPasswordResponse = {
  ok: true;
  newPassword: string;
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
  tags: string[];
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
  favoriteCount: number;
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
  isFavorited?: boolean;
};

export type ShareSystemTheme = {
  protocol: string;
  id: string;
  format: string;
  supported: boolean;
  name: string;
  author: string;
  version: string;
  description: string;
  tags: string[];
  fileName: string;
  mimeType: string;
  size: number;
};

export type DiscoverSystemThemeItem = {
  card: PlatformCard;
  creator: PublicCreator;
  stats: CardStats;
  asset: CardAsset;
  systemTheme: ShareSystemTheme;
  accessCodeStatus: "none" | "required" | "expired" | "exhausted";
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

export type PasswordResetRequestResponse = {
  ok: true;
  email: string;
  verificationRequired: boolean;
  expiresIn: number;
};

export type PasswordResetResendResponse = {
  ok: true;
  email: string;
  expiresIn: number;
};

export type PasswordResetCompleteResponse = {
  ok: true;
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

export type ShareSiteBrandingSettings = {
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
  canUpdate: boolean;
};

export type ShareMediaStorageMigrationSummary = {
  coversPending: number;
  assetsPending: number;
  totalPending: number;
  coversMissing: number;
  assetsMissing: number;
  totalMissing: number;
};

export type ShareMediaStorageMigrationPlan = {
  storageMode: "local" | "object_storage";
  localFallbackEnabled: boolean;
  coverNamespaceID: string;
  assetNamespaceID: string;
  canMigrate: boolean;
  summary: ShareMediaStorageMigrationSummary;
};

export type ShareMediaStorageMigrationRunResult = {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  deleteLocal: boolean;
  hasMore: boolean;
  messages: string[];
  summary: ShareMediaStorageMigrationSummary;
};

export type ShareAuthConfigResponse = {
  ok: true;
  config: ShareAuthConfig;
};

export type ShareAuthSettingsResponse = {
  ok: true;
  settings: ShareAuthSettings;
};

export type SharePublicMediaStorageSettingsResponse = {
  storage_mode: "local" | "object_storage";
};

export type ShareMediaStorageSettingsResponse = {
  ok: true;
  settings: ShareMediaStorageSettings;
  migration: ShareMediaStorageMigrationPlan;
};

export type ShareSiteBrandingSettingsResponse = {
  ok: true;
  settings: ShareSiteBrandingSettings;
};

export type ShareMediaStorageMigrationRunResponse = {
  ok: true;
  settings: ShareMediaStorageSettings;
  migration: ShareMediaStorageMigrationPlan;
  result: ShareMediaStorageMigrationRunResult;
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

export type SharePresignedUploadEntry = {
  url: string;
  object_key: string;
  version_id: string;
  storage_key: string;
  namespace_id: string;
  content_type: string;
};

export type SharePreparedCardBundleAsset = {
  slot: CardContentSlot;
} & SharePresignedUploadEntry;

export type SharePreparedCardBundleUpload = {
  card_id: string;
  cover?: SharePresignedUploadEntry;
  assets: SharePreparedCardBundleAsset[];
};

export type ShareUploadedMediaInfo = {
  object_key: string;
  version_id: string;
  etag: string;
  size: number;
  file_name: string;
  mime_type: string;
  namespace_id: string;
};

export type ShareUploadedAssetInfo = {
  slot: CardContentSlot;
} & ShareUploadedMediaInfo;

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
  systemTheme?: ShareSystemTheme;
  canEdit: boolean;
  canDownload: boolean;
  accessCodeStatus?: "none" | "required" | "expired" | "exhausted";
  isFavorited?: boolean;
};

export type FavoriteItem = {
  card: PlatformCard;
  creator: PublicCreator;
  stats: CardStats;
  isFavorited?: boolean;
};

export type FavoritesResponse = {
  cards: FavoriteItem[];
  pagination: DiscoverCardsPagination;
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
