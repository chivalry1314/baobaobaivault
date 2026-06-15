import type { CardContentSlot } from "@/lib/shared";

export const CATEGORY_SLOTS = [
  "system_theme",
  "wechat_theme",
  "app",
  "character_persona",
  "world_book",
  "desktop_component",
] as const satisfies readonly CardContentSlot[];

export const FILTER_CHIPS = ["all", ...CATEGORY_SLOTS] as const;
export type FilterChip = (typeof FILTER_CHIPS)[number];

export const CHIP_LABELS: Record<FilterChip, string> = {
  all: "全部",
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
  desktop_component: "桌面组件",
};

export const CHIP_VISUALS: Record<FilterChip, { className: string }> = {
  all: { className: "bg-[#aee7d9]" },
  system_theme: { className: "bg-[#facdf4]" },
  wechat_theme: { className: "bg-[#ff9c9c]" },
  app: { className: "bg-[#fcf1a7]" },
  character_persona: { className: "bg-[#cdb4f3]" },
  world_book: { className: "bg-[#ffcda8]" },
  desktop_component: { className: "bg-[#b8e0ff]" },
};

export const DISCOVER_PAGE_SIZE = 12;

export const CARD_BG_CLASSES = [
  "bg-[#fcf1a7]",
  "bg-[#facdf4]",
  "bg-[#aee7d9]",
  "bg-[#cdb4f3]",
];
