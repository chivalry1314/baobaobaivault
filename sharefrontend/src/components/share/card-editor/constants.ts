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

export const wechatThemeProtocol = "baobaobaiphone.wechat-theme-package.v1";

export const worldBookProtocol = "baobaobaiphone.world-book-package.v1";

export const characterPersonaProtocol = "baobaobaiphone.character-persona-package.v1";

export type CharacterPersonaContact = {
  name: string;
  phone: string;
  avatar: string;
  description: string;
  greeting: string;
  note: string;
};

export type CharacterPersonaMetadata = {
  version: number;
  contacts: CharacterPersonaContact[];
};

export const characterPersonaMetaDefaults: CharacterPersonaMetadata = {
  version: 1,
  contacts: [],
};

export const characterPersonaMetaLimits = {
  contact: {
    name: { min: 1, max: 80 },
    phone: { max: 40 },
    description: { max: 500 },
    greeting: { max: 500 },
    note: { max: 1000 },
  },
};

export type WorldBookTriggerMode = "keyword" | "constant" | "disabled";
export type WorldBookScope = "global" | "character";

export type WorldBookEntry = {
  id: string;
  name: string;
  keywords: string[];
  content: string;
  triggerMode: WorldBookTriggerMode;
  insertionOrder: number;
  scope: WorldBookScope;
};

export type WorldBookMetadata = {
  version: number;
  worldBook: WorldBookEntry[];
};

export const worldBookMetaDefaults: WorldBookMetadata = {
  version: 1,
  worldBook: [],
};

export const worldBookTriggerModeOptions: Array<{ value: WorldBookTriggerMode; label: string }> = [
  { value: "keyword", label: "关键词触发" },
  { value: "constant", label: "始终触发" },
  { value: "disabled", label: "已禁用" },
];

export const worldBookScopeOptions: Array<{ value: WorldBookScope; label: string }> = [
  { value: "global", label: "全局" },
  { value: "character", label: "角色" },
];

export type WechatThemeBubblePreset = "wechat" | "rounded" | "glass" | "outline";

export type WechatThemeMetadata = {
  chatBackgroundOpacity: number;
  selfBubblePreset: WechatThemeBubblePreset;
  peerBubblePreset: WechatThemeBubblePreset;
  rendererSource: string;
};

export const wechatThemeBubblePresetOptions: Array<{ value: WechatThemeBubblePreset; label: string }> = [
  { value: "wechat", label: "微信默认" },
  { value: "rounded", label: "柔和圆角" },
  { value: "glass", label: "玻璃感" },
  { value: "outline", label: "线框风" },
];

export const wechatThemeMetaDefaults: WechatThemeMetadata = {
  chatBackgroundOpacity: 0,
  selfBubblePreset: "wechat",
  peerBubblePreset: "wechat",
  rendererSource: "",
};

export const wechatThemeMetaLimits = {
  chatBackgroundOpacity: { min: 0, max: 1 },
};

export const wechatThemeImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"] as const;

export const wechatThemeMaxFileSize = 24 * 1024 * 1024;

export const wechatThemeMaxZipFiles = 50;
