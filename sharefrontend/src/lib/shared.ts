export type ExternalSessionUser = {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatar: string;
  bio: string;
  coverImage: string;
  phone: string;
  createdAt: string;
};

export type PlatformCard = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  visibility: "private" | "public";
  status: "draft" | "published" | "archived";
  originalFileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
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

export type SessionResponse = {
  authenticated: boolean;
  user: ExternalSessionUser | null;
};

export type ContinueAuthResponse = {
  ok: true;
  created: boolean;
  user: ExternalSessionUser;
};

export type DashboardCard = {
  card: PlatformCard;
  stats: CardStats;
  hasAccessCode: boolean;
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

export type CardDetailResponse = {
  card: PlatformCard;
  creator: PublicCreator;
  stats: CardStats;
  canEdit: boolean;
  canDownload: boolean;
  accessCodeStatus?: "none" | "required" | "expired" | "exhausted";
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
