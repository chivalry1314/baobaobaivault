import type { CardContentSlot } from "@/lib/shared";

export const slotOptions: Array<{ value: CardContentSlot; label: string }> = [
  { value: "system_theme", label: "系统主题" },
  { value: "wechat_theme", label: "微信主题" },
  { value: "app", label: "App" },
  { value: "character_persona", label: "角色人设" },
  { value: "world_book", label: "世界书" },
  { value: "desktop_component", label: "桌面组件" },
];

export const slotLabelMap: Record<CardContentSlot, string> = {
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
  desktop_component: "桌面组件",
};

export type DesktopComponentMetadata = {
  name: string;
  width: number;
  height: number;
  cornerRadius: number;
  frosted: number;
  shadow: number;
  backgroundOpacity: number;
};

export const desktopComponentMetaDefaults: DesktopComponentMetadata = {
  name: "",
  width: 2,
  height: 2,
  cornerRadius: 22,
  frosted: 8,
  shadow: 12,
  backgroundOpacity: 0,
};

export const desktopComponentMetaLimits = {
  width: { min: 1, max: 4 },
  height: { min: 1, max: 6 },
  cornerRadius: { min: 0, max: 64 },
  frosted: { min: 0, max: 64 },
  shadow: { min: 0, max: 64 },
  backgroundOpacity: { min: 0, max: 100 },
};

export const desktopComponentProtocol = "baobaobaiphone.desktop-component.v1";
