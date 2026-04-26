"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { shareApi } from "@/lib/share-api";
import type { DiscoverCardItem } from "@/lib/shared";

type HomeFeedCard = {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  creatorInitials: string;
  metric: string;
  href: string;
  imageUrl: string;
  mimeType: string;
  fileLabel: string;
  searchableText: string;
  tags: string[];
  isDemo?: boolean;
};

const filterChips = ["全部", "二次元", "恋爱", "插画", "动态", "风景", "水彩"] as const;

const demoCards: HomeFeedCard[] = [
  {
    id: "demo-sakura",
    title: "樱之梦",
    description: "粉樱、少女和柔光氛围，适合做梦幻系卡片封面。",
    creatorName: "Yuka_Art",
    creatorInitials: "YA",
    metric: "1.2k",
    href: "/login",
    imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=900&h=1300&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "插画",
    searchableText: "樱之梦 Yuka_Art 粉樱 少女 梦幻 插画",
    tags: ["二次元", "插画", "恋爱"],
    isDemo: true,
  },
  {
    id: "demo-sunset",
    title: "落日余晖",
    description: "海平面和晚霞层次，适合风景系公开展示。",
    creatorName: "Mikan_Studio",
    creatorInitials: "MS",
    metric: "856",
    href: "/discover",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&h=1200&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "风景",
    searchableText: "落日余晖 Mikan_Studio 晚霞 海边 风景",
    tags: ["风景"],
    isDemo: true,
  },
  {
    id: "demo-rose",
    title: "纯白誓言",
    description: "花语感和留白构图，很适合婚礼或纪念主题。",
    creatorName: "Shiro_Draws",
    creatorInitials: "SD",
    metric: "2.1k",
    href: "/creator",
    imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=900&h=1400&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "花卉",
    searchableText: "纯白誓言 Shiro_Draws 白玫瑰 花语 水彩 恋爱",
    tags: ["恋爱", "水彩"],
    isDemo: true,
  },
  {
    id: "demo-crystal",
    title: "星语心愿",
    description: "晶体、微光和紫粉色调，适合少女感封面或情绪海报。",
    creatorName: "Yuka_Art",
    creatorInitials: "YA",
    metric: "542",
    href: "/creator",
    imageUrl: "https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=900&h=1100&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "视觉",
    searchableText: "星语心愿 Yuka_Art 晶体 少女 梦幻 插画",
    tags: ["插画", "二次元"],
    isDemo: true,
  },
  {
    id: "demo-moon",
    title: "繁星之夜",
    description: "月色和渐变夜空，很适合安静系背景卡。",
    creatorName: "NightSky",
    creatorInitials: "NS",
    metric: "980",
    href: "/discover",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&h=1300&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "夜空",
    searchableText: "繁星之夜 NightSky 月亮 星空 风景",
    tags: ["风景"],
    isDemo: true,
  },
  {
    id: "demo-flower",
    title: "春之花语",
    description: "柔和花朵与轻雾质感，适合水彩风格卡片。",
    creatorName: "Flora_Fan",
    creatorInitials: "FF",
    metric: "731",
    href: "/creator",
    imageUrl: "https://images.unsplash.com/photo-1468327768560-75b778cbb551?w=900&h=1200&fit=crop",
    mimeType: "image/jpeg",
    fileLabel: "花语",
    searchableText: "春之花语 Flora_Fan 花朵 水彩 插画",
    tags: ["水彩", "插画"],
    isDemo: true,
  },
];

function getInitials(name: string) {
  const compact = name.trim();
  if (!compact) {
    return "CS";
  }

  const parts = compact.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return compact.slice(0, 2).toUpperCase();
}

function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }

  return String(count);
}

function topVisualClass(index: number) {
  const classes = [
    "aspect-[4/4.7]",
    "aspect-[4/3.6]",
    "aspect-[4/5.5]",
    "aspect-[4/3.1]",
    "aspect-[4/5]",
    "aspect-[4/3.7]",
  ];

  return classes[index % classes.length];
}

function matchesChip(card: HomeFeedCard, chip: (typeof filterChips)[number]) {
  if (chip === "全部") {
    return true;
  }

  return card.tags.includes(chip);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M10.5 4a6.5 6.5 0 1 0 4.057 11.58l4.431 4.432 1.061-1.061-4.432-4.431A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 4.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.75 8.25a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Zm2.25 5.25c-3.59 0-6.5 2.24-6.5 5v.75h13v-.75c0-2.76-2.91-5-6.5-5Zm-4.88 4.25c.48-1.58 2.39-2.75 4.88-2.75 2.49 0 4.4 1.17 4.88 2.75H7.12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 20.2 4.94 13.5a4.65 4.65 0 0 1 6.58-6.58L12 7.4l.48-.48a4.65 4.65 0 0 1 6.58 6.58L12 20.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AccountEntry() {
  return (
    <Link
      href="/login"
      aria-label="登录"
      className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-[var(--brand)] shadow-[0_12px_28px_-18px_rgba(241,93,135,0.55)] transition hover:scale-[1.03] hover:bg-[var(--surface-container)]"
    >
      <UserIcon />
    </Link>
  );
}

export default function LandingPage() {
  const [cards, setCards] = useState<DiscoverCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<(typeof filterChips)[number]>("全部");

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    async function loadCards() {
      setLoading(true);
      setError("");

      try {
        const payload = await shareApi.discoverCards();
        if (!active) {
          return;
        }

        startTransition(() => {
          setCards(payload.cards);
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "公开卡片加载失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCards();

    return () => {
      active = false;
    };
  }, []);

  const liveCards = useMemo<HomeFeedCard[]>(() => {
    return cards.map((item) => {
      const titleText = item.card.title ?? "未命名作品";
      const descriptionText = item.card.description || "公开创作者卡片";
      const creatorName = item.creator.nickname || item.creator.username || "Creator";
      const sourceText = `${titleText} ${descriptionText}`;

      return {
        id: item.card.id,
        title: titleText,
        description: descriptionText,
        creatorName,
        creatorInitials: getInitials(creatorName),
        metric: formatMetric(item.stats.downloadCount),
        href: `/cards/${encodeURIComponent(item.card.id)}`,
        imageUrl: item.card.previewUrl,
        mimeType: item.card.mimeType,
        fileLabel: item.card.originalFileName || "素材",
        searchableText: [
          titleText,
          descriptionText,
          item.creator.nickname,
          item.creator.username,
          item.card.originalFileName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        tags: [
          item.card.mimeType.startsWith("image/") ? "插画" : "动态",
          /花|rose|floral|flower|petal/i.test(sourceText) ? "水彩" : "",
          /夜空|星空|山|海|sky|sunset|landscape|moon/i.test(sourceText) ? "风景" : "",
          /爱|恋|love|sweet|wedding|romance/i.test(sourceText) ? "恋爱" : "",
          /anime|二次元|少女|插画|梦幻/i.test(sourceText) ? "二次元" : "",
        ].filter(Boolean),
      };
    });
  }, [cards]);

  const sourceCards = useMemo(
    () =>
      liveCards.length > 0
        ? liveCards
        : demoCards.map((card) => ({
            ...card,
            href: `/cards/${encodeURIComponent(card.id)}`,
          })),
    [liveCards],
  );

  const filteredCards = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();

    return sourceCards.filter((card) => {
      if (!matchesChip(card, activeChip)) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return card.searchableText.includes(keyword);
    });
  }, [activeChip, deferredQuery, sourceCards]);

  const footerLinks = [
    { label: "关于我们", href: "/discover" },
    { label: "隐私政策", href: "/login" },
    { label: "服务条款", href: "/creator" },
    { label: "帮助中心", href: "/discover" },
  ];

  const footer = (
    <footer className="relative z-10 border-t border-white/60 bg-[rgba(255,248,248,0.72)] px-6 py-10 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
        <div className="text-lg font-black uppercase tracking-[0.14em] text-[var(--brand)]/65">CardShare</div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--brand)]/55">
          {footerLinks.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-[var(--brand-strong)]">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="text-sm tracking-[0.12em] text-[var(--brand)]/55">© 2026 CardShare. 平台公开卡片首页。</div>
      </div>
    </footer>
  );

  return (
    <AppShell currentPath="/" footerSlot={footer}>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative mx-auto">
            <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--outline)]">
              <SearchIcon />
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索卡片、作者或标签..."
              className="w-full rounded-full border border-[var(--outline-variant)]/80 bg-[rgba(255,240,242,0.88)] py-5 pl-16 pr-6 text-lg text-[var(--foreground)] outline-none ring-0 transition placeholder:text-[var(--on-surface-variant)]/85 focus:border-[var(--brand)] focus:bg-white"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {filterChips.map((chip) => {
              const isActive = chip === activeChip;

              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveChip(chip)}
                  className={`rounded-full border px-6 py-2.5 text-base transition ${
                    isActive
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_12px_24px_-20px_rgba(120,85,94,0.85)]"
                      : "border-[var(--outline-variant)]/70 bg-[var(--surface-container-low)] text-[var(--foreground)] hover:border-[var(--brand)]/50 hover:bg-white"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 text-sm text-[var(--on-surface-variant)]/85">
            <span className="rounded-full bg-white/75 px-3 py-1 shadow-[0_8px_20px_-18px_rgba(120,85,94,0.45)]">
              {loading ? "正在同步公开卡片" : liveCards.length > 0 ? "平台公开作品" : "灵感示例"}
            </span>
            <span>{filteredCards.length} 张卡片</span>
          </div>
        </div>

        {error ? (
          <div className="mx-auto mt-6 max-w-3xl rounded-[22px] border border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}

        {filteredCards.length === 0 ? (
          <div className="mx-auto mt-12 max-w-3xl rounded-[34px] border border-white/70 bg-white/72 px-8 py-14 text-center shadow-[0_24px_60px_-38px_rgba(120,85,94,0.28)]">
            <p className="text-3xl font-semibold text-[var(--foreground)]">没有找到匹配的卡片</p>
            <p className="mt-4 text-base leading-7 text-[var(--on-surface-variant)]/80">
              可以试试更宽泛的关键词，或者切回“全部”继续浏览平台公开内容。
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveChip("全部");
                }}
                className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white"
              >
                清空筛选
              </button>
              <Link
                href="/creator"
                className="rounded-full border border-[var(--outline-variant)] bg-white px-6 py-3 text-sm font-medium text-[var(--foreground)]/78 transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
              >
                去创作中心
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCards.map((card, index) => {
              const isImage = card.mimeType.startsWith("image/");

              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className="group overflow-hidden rounded-[34px] border border-white/70 bg-[rgba(255,241,243,0.82)] shadow-[0_24px_60px_-38px_rgba(120,85,94,0.28)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_-38px_rgba(120,85,94,0.38)]"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className={`overflow-hidden bg-[var(--surface-container)] ${topVisualClass(index)}`}>
                    {isImage ? (
                      <img
                        src={card.imageUrl}
                        alt={card.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center bg-[linear-gradient(160deg,#fde2e6,#fad3fd)] px-6 text-center text-sm text-[var(--on-surface-variant)]">
                        {card.fileLabel}
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-[164px] flex-col px-5 pb-5 pt-4">
                    <div className="flex-1">
                      <h2 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                        {card.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--on-surface-variant)]/78">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-semibold text-[var(--on-primary-container)]">
                          {card.creatorInitials}
                        </div>
                        <span className="truncate text-sm text-[var(--on-surface-variant)]">{card.creatorName}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[var(--brand)]">
                        <HeartIcon />
                        <span className="text-sm">{card.metric}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
