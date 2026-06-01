import type { CardContentSlot } from "@/lib/shared";

export const slotOptions: Array<{ value: CardContentSlot; label: string }> = [
  { value: "system_theme", label: "系统主题" },
  { value: "wechat_theme", label: "微信主题" },
  { value: "app", label: "App" },
  { value: "character_persona", label: "角色人设" },
  { value: "world_book", label: "世界书" },
];

export const slotLabelMap: Record<CardContentSlot, string> = {
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
};
