export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
};

export type ShopMeta = {
  tenant: {
    id: string;
    code: string;
    name: string;
    description: string;
  };
  settings: {
    allowRegister: boolean;
  };
};

export type CardRecord = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  isPublic: boolean;
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
};

export type DownloadCodeRecord = {
  id: string;
  cardId: string;
  code: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
};

export type CardStats = {
  downloadCount: number;
  lastDownloadedAt: string | null;
};

export type DashboardCard = {
  card: CardRecord;
  codes: DownloadCodeRecord[];
  stats: CardStats;
};

export type DashboardStats = {
  totalCards: number;
  totalCodes: number;
  totalDownloads: number;
  last7DaysDownloads: number;
};

export type DashboardResponse = {
  user: SessionUser;
  cards: DashboardCard[];
  stats: DashboardStats;
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
};

export type PublicCardItem = {
  card: CardRecord;
  creator: PublicUser;
  stats: CardStats;
};

export type BrowseResponse = {
  cards: PublicCardItem[];
};

export type RedeemResult = {
  card: Pick<
    CardRecord,
    "id" | "title" | "description" | "originalFileName" | "mimeType" | "size" | "isPublic"
  >;
  code: Pick<DownloadCodeRecord, "code" | "maxUses" | "usedCount" | "expiresAt">;
  downloadUrl: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
};

export type ApiError = {
  error: string;
};
