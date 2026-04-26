"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { AuthCard } from "@/components/share/auth-card";
import { ShareProfileSettings } from "@/components/share/share-profile-settings";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { DashboardCard, DashboardResponse, ExternalSessionUser, PlatformCard } from "@/lib/shared";

type ActiveTab = "cards" | "collections" | "history";
type ActiveSection = "dashboard" | "settings";
type PanelMode = "create" | "edit" | null;

type ComposerDraft = {
  title: string;
  description: string;
  visibility: "private" | "public";
  status: "draft" | "published" | "archived";
  file: File | null;
  previewUrl: string;
};

function createEmptyDraft(): ComposerDraft {
  return {
    title: "",
    description: "",
    visibility: "public",
    status: "published",
    file: null,
    previewUrl: "",
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatUid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }

  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) % 900000;
  }

  return String(hash + 100000);
}

function formatCardCode(cardId: string) {
  return cardId.replace(/-/g, "").slice(0, 10).toUpperCase();
}

function formatMetricValue(value: number) {
  if (value < 1000) {
    return String(value);
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(value)
    .toUpperCase();
}

function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const username = user.username.trim();
  if (username) {
    return username;
  }

  return user.email.split("@")[0]?.trim() || "Card Share";
}

function getInitials(name: string) {
  const clean = name.trim();
  if (!clean) {
    return "CS";
  }

  return Array.from(clean).slice(0, 2).join("").toUpperCase();
}

function getUserTagline(user: ExternalSessionUser | null) {
  if (!user) {
    return "";
  }

  const bio = user.bio.trim();
  if (bio) {
    return bio;
  }

  return "在 Card Share 收集每一个灵感瞬间 ✨";
}

function isImageCard(card: PlatformCard) {
  return typeof card.mimeType === "string" && card.mimeType.startsWith("image/") && Boolean(card.previewUrl.trim());
}

function getCardRank(item: DashboardCard) {
  if (item.stats.downloadCount >= 50) {
    return { label: "SSR", className: "bg-[#ffe06f] text-[#6d3a00]" };
  }

  if (item.stats.downloadCount >= 10) {
    return { label: "SR", className: "bg-[#f4c7df] text-[#6c3756]" };
  }

  return { label: "R", className: "bg-[#d4f0ff] text-[#255d72]" };
}

function getVisibilityLabel(value: PlatformCard["visibility"]) {
  return value === "public" ? "公开展示" : "仅自己可见";
}

function getStatusLabel(value: PlatformCard["status"]) {
  switch (value) {
    case "published":
      return "已发布";
    case "draft":
      return "草稿";
    default:
      return "已归档";
  }
}

function defaultCardDescription(card: PlatformCard) {
  const text = card.description.trim();
  if (text) {
    return text;
  }

  return "把喜欢的画面和情绪收藏成一张卡片，随时分享给同频的人。";
}

function revokePreview(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function Avatar({
  user,
  size = "lg",
}: {
  user: ExternalSessionUser;
  size?: "sm" | "lg";
}) {
  const name = getDisplayName(user);
  const dimension = size === "sm" ? "h-14 w-14" : "h-28 w-28";
  const inner = size === "sm" ? "text-lg" : "text-3xl";

  if (user.avatar.trim()) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className={`${dimension} rounded-full object-cover shadow-[0_16px_36px_-24px_rgba(120,85,94,0.5)]`}
      />
    );
  }

  return (
    <div
      className={`${dimension} flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffdbe5_0%,#f6e8ff_100%)] font-semibold text-[var(--primary)] shadow-[0_16px_36px_-24px_rgba(120,85,94,0.5)] ${inner}`}
    >
      {getInitials(name)}
    </div>
  );
}

function SidebarButton({
  active = false,
  href,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className = `flex w-full items-center gap-3 rounded-full px-5 py-4 text-base transition ${
    active
      ? "bg-[linear-gradient(135deg,#ffd3de_0%,#f7c3d4_100%)] text-[var(--primary)] shadow-[0_18px_36px_-26px_rgba(216,75,115,0.45)]"
      : "text-[var(--foreground)]/74 hover:bg-white/78 hover:text-[var(--primary)]"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 pb-4 text-[1.15rem] transition sm:text-[1.35rem] ${
        active
          ? "border-[var(--primary)] text-[var(--foreground)]"
          : "border-transparent text-[var(--foreground)]/54 hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition ${
        active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-container-low)] text-[var(--foreground)]/72"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[32px] border border-white/80 bg-white/84 px-6 py-14 text-center shadow-[0_24px_56px_-38px_rgba(120,85,94,0.28)]">
      <p className="text-2xl font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--foreground)]/62">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-22px_rgba(120,85,94,0.45)] transition hover:-translate-y-0.5"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-22px_rgba(120,85,94,0.45)] transition hover:-translate-y-0.5"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function CreatorCard({
  item,
  onManage,
}: {
  item: DashboardCard;
  onManage: (card: DashboardCard) => void;
}) {
  const rank = getCardRank(item);
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const accessCodeHref = `/creator/cards/${encodeURIComponent(item.card.id)}/access-code`;

  return (
    <article className="rounded-[32px] border border-white/80 bg-white/84 p-5 shadow-[0_24px_56px_-38px_rgba(120,85,94,0.28)]">
      <Link
        href={editHref}
        className="relative block overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#20161a_0%,#3f2b32_100%)]"
      >
        {isImageCard(item.card) ? (
          <img src={item.card.previewUrl} alt={item.card.title} className="h-[248px] w-full object-cover" />
        ) : (
          <div className="flex h-[248px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] text-lg font-medium text-white/92">
            {item.card.title}
          </div>
        )}

        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-semibold ${rank.className}`}>{rank.label}</span>
        <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/88 text-[var(--primary)] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)]">
          <HeartIcon className="h-5 w-5" />
        </span>
      </Link>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={editHref} className="block text-[2rem] font-semibold leading-none text-[var(--foreground)]">
              {item.card.title}
            </Link>
          </div>
          <span className="rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-xs text-[var(--foreground)]/62">
            {getVisibilityLabel(item.card.visibility)}
          </span>
        </div>

        <p className="mt-3 min-h-[84px] text-base leading-8 text-[var(--foreground)]/72">{defaultCardDescription(item.card)}</p>
      </div>

      <div className="mt-4 border-t border-dashed border-[var(--outline-variant)] pt-4">
        <div className="rounded-[26px] bg-[linear-gradient(180deg,rgba(255,240,242,0.92),rgba(255,248,249,0.86))] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--foreground)]/42">提取码</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[1.08rem] tracking-[0.12em] text-[var(--primary)]">{item.hasAccessCode ? "已配置" : "未设置"}</div>
              <div className="mt-1 text-xs text-[var(--foreground)]/52">点击管理设置提取码规则</div>
            </div>

            <Link
              href={accessCodeHref}
              className="rounded-full border border-[#efb8d1] bg-white px-5 py-2.5 text-sm text-[var(--primary)] transition hover:border-[var(--primary)]"
            >
              管理
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function HistoryItem({
  item,
  onManage,
}: {
  item: DashboardCard;
  onManage: (card: DashboardCard) => void;
}) {
  const editHref = `/creator/cards/${encodeURIComponent(item.card.id)}/edit`;
  const accessCodeHref = `/creator/cards/${encodeURIComponent(item.card.id)}/access-code`;

  return (
    <article className="flex flex-col gap-4 rounded-[30px] border border-white/80 bg-white/84 p-4 shadow-[0_24px_56px_-38px_rgba(120,85,94,0.24)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={editHref}
          className="block h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)]"
        >
          {isImageCard(item.card) ? (
            <img src={item.card.previewUrl} alt={item.card.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm text-white/92">{item.card.title}</div>
          )}
        </Link>

        <div className="min-w-0">
          <Link href={editHref} className="block truncate text-xl font-semibold text-[var(--foreground)]">
            {item.card.title}
          </Link>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">
            最近更新于 {formatDate(item.card.updatedAt)}，卡片状态为 {getStatusLabel(item.card.status)}。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--foreground)]/56">
            <span className="rounded-full bg-[var(--surface-container-low)] px-3 py-1">{getVisibilityLabel(item.card.visibility)}</span>
            <span className="rounded-full bg-[var(--surface-container-low)] px-3 py-1">下载 {item.stats.downloadCount} 次</span>
            <span className="rounded-full bg-[var(--surface-container-low)] px-3 py-1">编号 {formatCardCode(item.card.id)}</span>
          </div>
        </div>
      </div>

      <Link
        href={accessCodeHref}
        className="rounded-full border border-[#efb8d1] bg-white px-5 py-2.5 text-sm text-[var(--primary)] transition hover:border-[var(--primary)] sm:shrink-0"
      >
        管理
      </Link>
    </article>
  );
}

function PanelField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/72">{label}</span>
      {children}
    </label>
  );
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function CreatorStudio() {
  const router = useRouter();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("cards");

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedCard, setSelectedCard] = useState<DashboardCard | null>(null);
  const [draft, setDraft] = useState<ComposerDraft>(createEmptyDraft);
  const [panelPending, setPanelPending] = useState(false);
  const [panelError, setPanelError] = useState("");

  const cards = dashboard?.cards ?? [];

  const displayName = useMemo(() => (currentUser ? getDisplayName(currentUser) : ""), [currentUser]);

  const accountLabel = useMemo(() => {
    if (!currentUser) {
      return "";
    }

    const username = currentUser.username.trim();
    return username ? `@${username}` : currentUser.email;
  }, [currentUser]);

  const heroStats = useMemo(
    () => [
      { value: formatMetricValue(dashboard?.stats.totalCards ?? 0), label: "创作卡片" },
      { value: formatMetricValue(dashboard?.stats.totalPublic ?? 0), label: "公开展示" },
      { value: formatMetricValue(dashboard?.stats.totalDownloads ?? 0), label: "累计下载", accent: true },
    ],
    [dashboard],
  );

  const historyItems = useMemo(() => {
    return [...cards].sort((left, right) => {
      const leftTime = new Date(left.card.updatedAt).getTime();
      const rightTime = new Date(right.card.updatedAt).getTime();
      return rightTime - leftTime;
    });
  }, [cards]);

  const heroSurfaceStyle = useMemo(() => {
    if (!currentUser?.coverImage.trim()) {
      return undefined;
    }

    return {
      backgroundImage: `linear-gradient(135deg,rgba(255,255,255,0.84) 0%,rgba(255,239,243,0.76) 52%,rgba(255,247,235,0.86) 100%), url(${currentUser.coverImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [currentUser]);

  const loadDashboard = useCallback(async () => {
    const payload = await shareApi.myCards();
    setCurrentUser(payload.user);
    setDashboard(payload);
    setLoadError("");
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        if (!session.authenticated || !session.user) {
          setCurrentUser(null);
          setDashboard(null);
          return;
        }

        setCurrentUser(session.user);

        try {
          await loadDashboard();
        } catch (error) {
          if (!active) {
            return;
          }

          setLoadError(getShareErrorMessage(error, "加载用户详情失败，请稍后重试"));
          setDashboard(null);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(getShareErrorMessage(error, "检查登录状态失败，请稍后重试"));
        setCurrentUser(null);
        setDashboard(null);
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    return () => {
      revokePreview(draft.previewUrl);
    };
  }, [draft.previewUrl]);

  function handleProfileSaved(user: ExternalSessionUser) {
    setCurrentUser(user);
    setDashboard((current) => (current ? { ...current, user } : current));
  }

  function closePanel() {
    revokePreview(draft.previewUrl);
    setPanelMode(null);
    setSelectedCard(null);
    setDraft(createEmptyDraft());
    setPanelPending(false);
    setPanelError("");
  }

  function openCreatePanel() {
    router.push("/creator/new");
  }

  function openEditPanel(card: DashboardCard) {
    router.push(`/creator/cards/${encodeURIComponent(card.card.id)}/access-code`);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    revokePreview(draft.previewUrl);
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";

    setDraft((current) => ({
      ...current,
      file,
      previewUrl,
    }));
  }

  async function handleReload() {
    try {
      await loadDashboard();
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "重新加载失败，请稍后重试"));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.file) {
      setPanelError("请先上传要发布的卡片文件。");
      return;
    }

    setPanelPending(true);
    setPanelError("");

    try {
      await shareApi.createCard({
        title: draft.title,
        description: draft.description,
        visibility: draft.visibility,
        status: draft.status,
        file: draft.file,
      });

      await loadDashboard();
      closePanel();
    } catch (error) {
      setPanelError(getShareErrorMessage(error, "创建卡片失败，请稍后重试"));
      setPanelPending(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCard) {
      return;
    }

    setPanelPending(true);
    setPanelError("");

    try {
      await shareApi.updateCard(selectedCard.card.id, {
        title: draft.title,
        description: draft.description,
        visibility: draft.visibility,
        status: draft.status,
      });

      await loadDashboard();
      closePanel();
    } catch (error) {
      setPanelError(getShareErrorMessage(error, "保存修改失败，请稍后重试"));
      setPanelPending(false);
    }
  }

  async function handleDelete() {
    if (!selectedCard) {
      return;
    }

    const confirmed = window.confirm(`确认删除「${selectedCard.card.title}」吗？`);
    if (!confirmed) {
      return;
    }

    setPanelPending(true);
    setPanelError("");

    try {
      await shareApi.deleteCard(selectedCard.card.id);
      await loadDashboard();
      closePanel();
    } catch (error) {
      setPanelError(getShareErrorMessage(error, "删除卡片失败，请稍后重试"));
      setPanelPending(false);
    }
  }

  async function handleLogout() {
    await shareApi.logout().catch(() => null);
    closePanel();
    setCurrentUser(null);
    setDashboard(null);
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          正在加载你的创作空间...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <AuthCard afterSuccess="/creator" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fff9f8_0%,#fffdfb_45%,#fff5f7_100%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-12 h-80 w-80 rounded-full bg-[rgba(255,209,220,0.34)] blur-3xl" />
        <div className="absolute right-[-80px] top-52 h-80 w-80 rounded-full bg-[rgba(250,211,253,0.28)] blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-[rgba(255,226,231,0.4)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1560px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="rounded-[38px] border border-white/80 bg-white/84 p-6 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.35)] backdrop-blur-xl lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-10 lg:min-h-[calc(100vh-3rem)]">
            <div>
              <div className="flex items-center gap-4">
                <Avatar user={currentUser} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[1.75rem] font-semibold text-[var(--foreground)]">{displayName}</p>
                  <p className="mt-1 text-sm text-[var(--foreground)]/54">UID: {formatUid(currentUser.id)}</p>
                </div>
              </div>

              <div className="mt-10 space-y-3">
                <SidebarButton href="/" icon={<HomeIcon className="h-5 w-5" />}>
                  首页
                </SidebarButton>
                <SidebarButton
                  active={activeSection === "dashboard"}
                  onClick={() => setActiveSection("dashboard")}
                  icon={<CardIcon className="h-5 w-5" />}
                >
                  我的卡片
                </SidebarButton>
                <SidebarButton href="/creator/access-codes" icon={<KeyIcon className="h-5 w-5" />}>
                  提取码管理
                </SidebarButton>
                <SidebarButton
                  active={activeSection === "settings"}
                  onClick={() => setActiveSection("settings")}
                  icon={<SettingsIcon className="h-5 w-5" />}
                >
                  个人信息设置
                </SidebarButton>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--outline-variant)] px-4 py-3 text-sm text-[var(--foreground)]/68 transition hover:border-[var(--primary)] hover:text-[var(--primary)] lg:mt-auto"
            >
              退出登录
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          {loadError ? (
            <div className="flex flex-col gap-3 rounded-[28px] border border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] shadow-[0_20px_40px_-34px_rgba(154,52,18,0.4)] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="w-fit rounded-full border border-[#f1b18a] px-4 py-2 text-sm transition hover:bg-white/80"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {activeSection === "dashboard" ? (
            <>
              <section className="overflow-hidden rounded-[40px] border border-white/80 bg-white/84 p-3 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.35)] backdrop-blur-xl">
                <div
                  className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,rgba(255,255,255,0.94) 0%,rgba(255,239,243,0.86) 52%,rgba(255,247,235,0.95) 100%)] px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
                  style={heroSurfaceStyle}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-[-2%] top-[-12%] h-44 w-44 rounded-full bg-[rgba(255,208,219,0.52)] blur-[36px]" />
                    <div className="absolute left-[10%] top-[6%] h-24 w-24 rounded-full bg-[rgba(255,255,255,0.9)] blur-[12px]" />
                    <div className="absolute left-[16%] top-[18%] h-20 w-20 rounded-full bg-[rgba(252,214,225,0.55)] blur-[18px]" />
                    <div className="absolute right-[18%] top-[8%] h-28 w-28 rounded-full bg-[rgba(255,228,236,0.55)] blur-[24px]" />
                    <div className="absolute bottom-[10%] right-[14%] h-36 w-36 rounded-full bg-[rgba(255,246,233,0.7)] blur-[34px]" />
                    <div className="absolute left-[6%] bottom-[14%] h-24 w-24 rounded-full bg-[rgba(255,221,230,0.44)] blur-[22px]" />
                    <div className="absolute left-[22%] top-[2%] h-16 w-8 rotate-[-26deg] rounded-full bg-[rgba(207,160,100,0.32)] blur-[2px]" />
                    <div className="absolute left-[25%] top-[5%] h-16 w-8 rotate-[18deg] rounded-full bg-[rgba(166,126,78,0.22)] blur-[2px]" />
                  </div>

                  <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                      <div className="relative shrink-0">
                        <div className="rounded-full border-[6px] border-white/90 bg-white/85 p-1 shadow-[0_22px_54px_-34px_rgba(120,85,94,0.45)]">
                          <Avatar user={currentUser} />
                        </div>
                      </div>

                      <div className="max-w-2xl">
                        <p className="text-sm uppercase tracking-[0.28em] text-[var(--primary)]/55">Card Share</p>
                        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[3.5rem]">{displayName}</h1>
                        <p className="mt-3 text-lg text-[var(--foreground)]/68 sm:text-xl">{getUserTagline(currentUser)}</p>
                        <p className="mt-4 text-sm text-[var(--foreground)]/50">{accountLabel}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[30px] border border-white/70 bg-white/78 p-4 shadow-[0_22px_54px_-38px_rgba(120,85,94,0.35)] sm:grid-cols-3">
                      {heroStats.map((item) => (
                        <div key={item.label} className="min-w-[112px] rounded-[22px] px-4 py-4 text-center">
                          <div className={`text-[2.25rem] font-semibold ${item.accent ? "text-[#f3a6c2]" : "text-[var(--foreground)]"}`}>{item.value}</div>
                          <div className={`mt-1 text-sm ${item.accent ? "text-[#9b5a77]" : "text-[var(--foreground)]/62"}`}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[40px] border border-white/80 bg-white/84 px-6 py-6 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.3)] backdrop-blur-xl sm:px-8 sm:py-8">
                <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-6">
                    <TabButton active={activeTab === "cards"} onClick={() => setActiveTab("cards")}>
                      我的创作
                    </TabButton>
                    <TabButton active={activeTab === "collections"} onClick={() => setActiveTab("collections")}>
                      我的收藏
                    </TabButton>
                    <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                      历史记录
                    </TabButton>
                  </div>

                  <button
                    type="button"
                    onClick={openCreatePanel}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-20px_rgba(120,85,94,0.45)] transition hover:-translate-y-0.5"
                  >
                    <PlusIcon className="h-4 w-4" />
                    创作卡片
                  </button>
                </div>

                <div className="pt-6">
                  {activeTab === "cards" ? (
                    cards.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {cards.map((item) => (
                          <CreatorCard key={item.card.id} item={item} onManage={openEditPanel} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="还没有卡片"
                        description="先创建你的第一张卡片，把灵感和内容收藏进个人主页。"
                        actionLabel="创建卡片"
                        onAction={openCreatePanel}
                      />
                    )
                  ) : null}

                  {activeTab === "collections" ? (
                    <EmptyState
                      title="收藏功能正在准备中"
                      description="你以后收藏的卡片会出现在这里，现在可以先去发现页逛逛。"
                      actionLabel="去发现页"
                      actionHref="/discover"
                    />
                  ) : null}

                  {activeTab === "history" ? (
                    historyItems.length > 0 ? (
                      <div className="space-y-4">
                        {historyItems.map((item) => (
                          <HistoryItem key={item.card.id} item={item} onManage={openEditPanel} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="还没有历史记录"
                        description="当你创建或更新卡片后，最近操作会在这里出现。"
                        actionLabel="创建卡片"
                        onAction={openCreatePanel}
                      />
                    )
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <ShareProfileSettings user={currentUser} onSaved={handleProfileSaved} />
          )}
        </main>
      </div>

      {panelMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[rgba(38,24,27,0.18)] p-4 backdrop-blur-sm sm:p-6">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭卡片面板" onClick={closePanel} />

          <aside className="relative z-10 h-full w-full max-w-[480px] overflow-y-auto rounded-[34px] border border-white/80 bg-white/94 p-6 shadow-[0_34px_90px_-40px_rgba(38,24,27,0.4)] sm:p-7">
            {panelMode === "create" ? (
              <PanelSection title="创建卡片" description="上传新的卡片素材，补充标题和说明后即可保存到你的个人主页。">
                {panelError ? (
                  <p className="rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{panelError}</p>
                ) : null}

                <form className="space-y-4" onSubmit={handleCreate}>
                  <PanelField label="卡片标题">
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                      placeholder="输入这张卡片的标题"
                      required
                    />
                  </PanelField>

                  <PanelField label="卡片说明">
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      rows={5}
                      className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                      placeholder="写下这张卡片的灵感、场景或分享说明"
                    />
                  </PanelField>

                  <PanelField label="可见范围">
                    <div className="flex flex-wrap gap-3">
                      <ToggleChip active={draft.visibility === "public"} onClick={() => setDraft((current) => ({ ...current, visibility: "public" }))}>
                        公开展示
                      </ToggleChip>
                      <ToggleChip active={draft.visibility === "private"} onClick={() => setDraft((current) => ({ ...current, visibility: "private" }))}>
                        仅自己可见
                      </ToggleChip>
                    </div>
                  </PanelField>

                  <PanelField label="发布状态">
                    <div className="flex flex-wrap gap-3">
                      <ToggleChip active={draft.status === "published"} onClick={() => setDraft((current) => ({ ...current, status: "published" }))}>
                        已发布
                      </ToggleChip>
                      <ToggleChip active={draft.status === "draft"} onClick={() => setDraft((current) => ({ ...current, status: "draft" }))}>
                        草稿
                      </ToggleChip>
                      <ToggleChip active={draft.status === "archived"} onClick={() => setDraft((current) => ({ ...current, status: "archived" }))}>
                        已归档
                      </ToggleChip>
                    </div>
                  </PanelField>

                  <PanelField label="上传卡片文件">
                    <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-6 text-center">
                      {draft.previewUrl ? (
                        <img src={draft.previewUrl} alt="上传预览" className="max-h-[220px] rounded-[18px] object-cover" />
                      ) : (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-[0_16px_34px_-22px_rgba(120,85,94,0.35)]">
                            <PlusIcon className="h-5 w-5" />
                          </div>
                          <p className="mt-4 text-base font-medium text-[var(--foreground)]">点击选择图片或卡片文件</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/58">如果上传的是图片，会在这里显示预览。</p>
                        </>
                      )}
                      <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                    <div className="mt-3 text-sm text-[var(--foreground)]/58">{draft.file ? draft.file.name : "还没有选择文件"}</div>
                  </PanelField>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-full border border-[var(--outline-variant)] px-5 py-3 text-sm text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={panelPending}
                      className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-20px_rgba(120,85,94,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {panelPending ? "正在创建..." : "创建卡片"}
                    </button>
                  </div>
                </form>
              </PanelSection>
            ) : null}

            {panelMode === "edit" && selectedCard ? (
              <PanelSection title="管理卡片" description="可以在这里修改标题、说明、可见范围和发布状态。卡片文件本身暂不支持替换。">
                {panelError ? (
                  <p className="rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{panelError}</p>
                ) : null}

                <div className="overflow-hidden rounded-[26px] border border-white/80 bg-[var(--surface-container-low)]">
                  {draft.previewUrl ? (
                    <img src={draft.previewUrl} alt={selectedCard.card.title} className="h-[220px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[220px] items-center justify-center bg-[linear-gradient(135deg,#382129_0%,#71545c_100%)] px-6 text-center text-lg font-medium text-white">
                      {selectedCard.card.title}
                    </div>
                  )}
                </div>

                <form className="space-y-4" onSubmit={handleUpdate}>
                  <PanelField label="卡片标题">
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                      required
                    />
                  </PanelField>

                  <PanelField label="卡片说明">
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      rows={5}
                      className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                    />
                  </PanelField>

                  <PanelField label="可见范围">
                    <div className="flex flex-wrap gap-3">
                      <ToggleChip active={draft.visibility === "public"} onClick={() => setDraft((current) => ({ ...current, visibility: "public" }))}>
                        公开展示
                      </ToggleChip>
                      <ToggleChip active={draft.visibility === "private"} onClick={() => setDraft((current) => ({ ...current, visibility: "private" }))}>
                        仅自己可见
                      </ToggleChip>
                    </div>
                  </PanelField>

                  <PanelField label="发布状态">
                    <div className="flex flex-wrap gap-3">
                      <ToggleChip active={draft.status === "published"} onClick={() => setDraft((current) => ({ ...current, status: "published" }))}>
                        已发布
                      </ToggleChip>
                      <ToggleChip active={draft.status === "draft"} onClick={() => setDraft((current) => ({ ...current, status: "draft" }))}>
                        草稿
                      </ToggleChip>
                      <ToggleChip active={draft.status === "archived"} onClick={() => setDraft((current) => ({ ...current, status: "archived" }))}>
                        已归档
                      </ToggleChip>
                    </div>
                  </PanelField>

                  <div className="rounded-[24px] bg-[var(--surface-container-low)] px-4 py-4 text-sm leading-7 text-[var(--foreground)]/62">
                    卡片编号：{formatCardCode(selectedCard.card.id)}
                    <br />
                    最近更新：{formatDate(selectedCard.card.updatedAt)}
                    <br />
                    当前状态：{getStatusLabel(selectedCard.card.status)}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={panelPending}
                      className="rounded-full border border-[#efb8c8] px-5 py-3 text-sm text-[#9d3656] transition hover:border-[#c45a7d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      删除卡片
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={closePanel}
                        className="rounded-full border border-[var(--outline-variant)] px-5 py-3 text-sm text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={panelPending}
                        className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-20px_rgba(120,85,94,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {panelPending ? "正在保存..." : "保存修改"}
                      </button>
                    </div>
                  </div>
                </form>
              </PanelSection>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 3.75 3.75 10.3V20.25h5.25V14.5h6v5.75h5.25V10.3L12 3.75Z" fill="currentColor" />
    </svg>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 4.5h9A3.75 3.75 0 0 1 20.25 8.25v7.5A3.75 3.75 0 0 1 16.5 19.5h-9a3.75 3.75 0 0 1-3.75-3.75v-7.5A3.75 3.75 0 0 1 7.5 4.5Zm0 1.5A2.25 2.25 0 0 0 5.25 8.25v.75h13.5v-.75A2.25 2.25 0 0 0 16.5 6h-9Zm11.25 4.5H5.25v5.25A2.25 2.25 0 0 0 7.5 18h9a2.25 2.25 0 0 0 2.25-2.25V10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3.75 1.07 1.94 2.2.39 1.56-1.6 1.59 1.58-1.61 1.6.4 2.2 1.89 1.09-.63 2.18-2.18-.02-1.55 1.59.38 2.18-2.11.85-1.01-1.93-2.19-.01-1.02 1.93-2.1-.85.38-2.18-1.55-1.59-2.18.02-.63-2.18 1.89-1.09.4-2.2-1.61-1.6 1.59-1.58 1.56 1.6 2.2-.39L12 3.75Zm0 5.25A3 3 0 1 0 12 15a3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function KeyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M13.5 6a4.5 4.5 0 1 0 3.96 6.64l4.79.01v1.5h-1.5v1.5h-1.5v1.5h-2.25V15.9h-1.33A4.5 4.5 0 0 0 13.5 6Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12h-5.25v-1.5h5.25V5.25Z" fill="currentColor" />
    </svg>
  );
}
