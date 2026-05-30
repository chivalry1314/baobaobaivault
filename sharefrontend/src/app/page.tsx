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
  metric: string;
  href: string;
  imageUrl: string;
  searchableText: string;
  tags: string[];
  bgClass: string;
};

const filterChips = ["全部", "二次元", "恋爱", "插画", "动态", "风景", "水彩"] as const;

const chipVisuals: Record<(typeof filterChips)[number], { className: string }> = {
  全部: { className: "bg-[#aee7d9]" },
  二次元: { className: "bg-[#facdf4]" },
  恋爱: { className: "bg-[#ff9c9c]" },
  插画: { className: "bg-[#fcf1a7]" },
  动态: { className: "bg-[#cdb4f3]" },
  风景: { className: "bg-[#aee7d9]" },
  水彩: { className: "bg-[#ffcda8]" },
};

const demoCards: HomeFeedCard[] = [
  {
    id: "demo-sakura",
    title: "Sakura",
    description: "轻柔春日与粉色光影，适合恋爱与梦幻氛围主题。",
    creatorName: "Luna_Art",
    metric: "1.2k",
    href: "/cards/demo-sakura",
    imageUrl: "/api/demo-media?id=demo-sakura&w=900&h=1300&kind=card",
    searchableText: "sakura anime luna art",
    tags: ["二次元", "恋爱"],
    bgClass: "bg-[#cdb4f3]",
  },
  {
    id: "demo-sunset",
    title: "Sunset",
    description: "暮色海岸和暖金色调，适合作为风景类主页封面。",
    creatorName: "Mikan_Studio",
    metric: "856",
    href: "/cards/demo-sunset",
    imageUrl: "/api/demo-media?id=demo-sunset&w=900&h=1200&kind=card",
    searchableText: "sunset sea landscape",
    tags: ["风景", "插画"],
    bgClass: "bg-[#aee7d9]",
  },
  {
    id: "demo-rose",
    title: "Rose",
    description: "玫瑰与奶油高光质感，适合恋爱主题与头像卡面。",
    creatorName: "Shiro_Draws",
    metric: "2.1k",
    href: "/cards/demo-rose",
    imageUrl: "/api/demo-media?id=demo-rose&w=900&h=1400&kind=card",
    searchableText: "rose romance flower",
    tags: ["恋爱", "插画"],
    bgClass: "bg-[#fcf1a7]",
  },
  {
    id: "demo-crystal",
    title: "Crystal",
    description: "通透晶体风格和舞台灯效，适合高亮展示位。",
    creatorName: "Yuka_Art",
    metric: "542",
    href: "/cards/demo-crystal",
    imageUrl: "/api/demo-media?id=demo-crystal&w=900&h=1100&kind=card",
    searchableText: "crystal fantasy",
    tags: ["插画", "动态"],
    bgClass: "bg-[#facdf4]",
  },
  {
    id: "demo-moon",
    title: "Moon",
    description: "夜色与月光层次明确，适合暗调插图与故事封面。",
    creatorName: "NightSky",
    metric: "980",
    href: "/cards/demo-moon",
    imageUrl: "/api/demo-media?id=demo-moon&w=900&h=1300&kind=card",
    searchableText: "moon star night",
    tags: ["二次元", "风景"],
    bgClass: "bg-[#cdb4f3]",
  },
  {
    id: "demo-watercolor",
    title: "Watercolor",
    description: "松弛笔触与淡色叠染，适合水彩与手作风格内容。",
    creatorName: "Flora_Fan",
    metric: "731",
    href: "/cards/demo-watercolor",
    imageUrl: "/api/demo-media?id=demo-flower&w=900&h=1200&kind=card",
    searchableText: "watercolor brush",
    tags: ["水彩", "插画"],
    bgClass: "bg-white",
  },
];

function formatMetric(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function matchesChip(card: HomeFeedCard, chip: (typeof filterChips)[number]) {
  if (chip === "全部") {
    return true;
  }
  return card.tags.includes(chip);
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
        setError(loadError instanceof Error ? loadError.message : "加载失败，请稍后重试。");
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
      const descriptionText = item.card.description || "创作者暂未补充描述。";
      const creatorName = item.creator.nickname || item.creator.username || "Creator";
      const sourceText = `${titleText} ${descriptionText}`.toLowerCase();

      const tags = [
        /anime|二次元|插画|角色/.test(sourceText) ? "二次元" : "",
        /love|恋爱|rose|甜/.test(sourceText) ? "恋爱" : "",
        item.card.mimeType.startsWith("image/") ? "插画" : "动态",
        /sunset|sky|landscape|moon|mountain|风景/.test(sourceText) ? "风景" : "",
        /watercolor|水彩|wash/.test(sourceText) ? "水彩" : "",
      ].filter(Boolean);

      return {
        id: item.card.id,
        title: titleText,
        description: descriptionText,
        creatorName,
        metric: formatMetric(item.stats.downloadCount),
        href: `/cards/${encodeURIComponent(item.card.id)}`,
        imageUrl: item.card.previewUrl,
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
        tags,
        bgClass: ["bg-[#fcf1a7]", "bg-[#facdf4]", "bg-[#aee7d9]", "bg-[#cdb4f3]"][item.card.id.length % 4],
      };
    });
  }, [cards]);

  const sourceCards = useMemo(() => (liveCards.length > 0 ? liveCards : demoCards), [liveCards]);

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

  const featuredCards = filteredCards.slice(0, 6);

  const footer = (
    <footer className="relative z-10 px-5 pb-6 pt-6">
      <div className="mx-auto max-w-[var(--layout-max)] rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-4 text-center text-sm font-bold text-[var(--foreground)] sm:text-left">
        © 2026 Dreamy Card Gallery
      </div>
    </footer>
  );

  return (
    <AppShell currentPath="/" footerSlot={footer}>
      <section className="relative z-10 mx-auto mt-3 w-full max-w-[var(--layout-max)] px-4 pb-6 md:px-6">
        <main className="mt-4 w-full">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 xl:mx-0">
            <div className="group relative">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-full border-[4px] border-[var(--outline)] bg-white px-5 py-3 pr-16 text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition-all group-hover:bg-gray-50"
              />
              <button className="absolute bottom-1.5 right-1.5 top-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[var(--outline)] bg-[#cdb4f3] transition-all hover:opacity-90">
                <SearchIcon />
              </button>
            </div>

            <div className="no-scrollbar flex items-end justify-between gap-3 overflow-x-auto px-1 py-1 lg:gap-5">
              {filterChips.map((chip) => {
                const active = chip === activeChip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveChip(chip)}
                    className="group shrink-0 cursor-pointer"
                  >
                    <span className="flex flex-col items-center gap-2">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-[4px] border-[var(--outline)] xl:h-14 xl:w-14 ${active ? "bg-[#cdb4f3]" : chipVisuals[chip].className} transition-all group-hover:opacity-90`}
                      >
                        <ChipIcon chip={chip} />
                      </span>
                      <span className="text-sm font-extrabold text-[var(--foreground)] xl:text-base">{chip}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="rounded-2xl border-[4px] border-[#c26b5b] bg-[#fff0eb] px-4 py-3 text-sm font-bold text-[#8e2b1b]">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredCards.length > 0 ? (
                featuredCards.map((card, index) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className={`${card.bgClass} dream-card card-hover-lift fade-slide-in flex flex-col p-3.5`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="relative mb-2.5">
                      <div className="absolute left-2 top-2 z-10">
                        <span className="rounded-full border-[3px] border-[var(--outline)] bg-white px-3 py-0.5 text-xs font-black text-[var(--foreground)]">
                          #{card.tags[0] || "精选"}
                        </span>
                      </div>
                      <div className="aspect-[4/3] overflow-hidden rounded-2xl border-[3px] border-[var(--outline)] bg-white">
                        <img src={card.imageUrl} className="h-full w-full object-cover object-center" alt={card.title} />
                      </div>
                    </div>

                    <h4 className="px-1 text-[1.5rem] font-black text-[var(--foreground)]">{card.title}</h4>
                    <p className="mt-1.5 line-clamp-2 text-sm font-bold text-[var(--on-surface-variant)]">{card.description}</p>
                    <div className="mt-2.5 flex items-center justify-between px-1 text-xs font-bold text-[var(--foreground)]/68">
                      <span>{card.creatorName}</span>
                      <span>{card.metric}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full rounded-3xl border-[4px] border-[var(--outline)] bg-white px-5 py-9 text-center text-[var(--foreground)]">
                  <p className="text-2xl font-black">没有找到匹配内容</p>
                  <p className="mt-3 font-bold">当前筛选无结果，请尝试切换分类或关键词。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveChip("全部");
                    }}
                    className="btn-primary mt-4 rounded-full px-5 py-2.5 font-black"
                  >
                    重置筛选
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="metric-pill rounded-full px-3 py-1.5 font-black">{loading ? "加载中..." : `共 ${sourceCards.length} 张`}</span>
              <span className="metric-pill rounded-full px-3 py-1.5 font-black">筛选后 {filteredCards.length} 张</span>
            </div>
          </div>
        </main>
      </section>
    </AppShell>
  );
}

function ChipIcon({ chip }: { chip: (typeof filterChips)[number] }) {
  switch (chip) {
    case "全部":
      return <GridIcon />;
    case "二次元":
      return <SparkleIcon />;
    case "恋爱":
      return <HeartIcon />;
    case "插画":
      return <PencilIcon />;
    case "动态":
      return <PlayIcon />;
    case "风景":
      return <MountainIcon />;
    case "水彩":
      return <BrushIcon />;
    default:
      return <GridIcon />;
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="4">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2 14 8.8 21 12l-7 3.2L12 22l-2-6.8L3 12l7-3.2L12 2Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)] fill-[#ff9c9c]" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 20.2 4.94 13.5a4.65 4.65 0 0 1 6.58-6.58L12 7.4l.48-.48a4.65 4.65 0 0 1 6.58 6.58L12 20.2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m14.8 3.6 5.6 5.6-9.9 9.9-6 .4.4-6 9.9-9.9Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="m10 8.7 6 3.3-6 3.3V8.7Z" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3.5 18h17L15 10.5l-3.4 4.1-2.5-2.8L3.5 18Z" />
      <circle cx="18" cy="7" r="1.6" />
    </svg>
  );
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--foreground)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m18.6 4.1-9.9 9.9a3.2 3.2 0 0 1-4.5 0L3 15.2a3.2 3.2 0 0 0 0 4.5l1.2 1.2a3.2 3.2 0 0 0 4.5 0l9.9-9.9" />
    </svg>
  );
}
