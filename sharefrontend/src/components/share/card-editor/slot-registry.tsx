import type { ReactNode } from "react";

import type { CardAsset, CardContentSlot, CardDetailResponse } from "@/lib/shared";
import { DesktopComponentSpecPanel } from "@/components/share/card-editor/DesktopComponentSpecPanel";
import { WechatThemeSpecPanel } from "@/components/share/card-editor/WechatThemeSpecPanel";
import { WorldBookSpecPanel } from "@/components/share/card-editor/WorldBookSpecPanel";
import { CharacterPersonaSpecPanel } from "@/components/share/card-editor/CharacterPersonaSpecPanel";

export type SlotPanelContext = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  loadedCard?: CardDetailResponse | null;
  asset?: CardAsset | null;
  disabled?: boolean;
  previewTitle?: string;
};

export type SlotDefinition = {
  slot: CardContentSlot;
  label: string;
  accept?: string;
  description: string;
  editDescription?: string;
  showFileInput: boolean;
  renderCreatePanel: (ctx: SlotPanelContext) => ReactNode;
  renderEditPanel?: (ctx: SlotPanelContext) => ReactNode;
};

const slots: SlotDefinition[] = [
  {
    slot: "system_theme",
    label: "系统主题",
    accept: ".zip,.json",
    description: "系统主题会按 `baobaobaiphone` 当前导入规则校验，仅支持可解析的 `.zip` / `.json` 主题包。",
    editDescription: "替换系统主题时会校验主题包能否被 `baobaobaiphone` 正常解析和导入。",
    showFileInput: true,
    renderCreatePanel: () => null,
    renderEditPanel: () => null,
  },
  {
    slot: "wechat_theme",
    label: "微信主题",
    accept: ".zip,.json",
    description: "微信主题包支持直接上传 `.zip` / `.json`，也可以通过下方表单一键生成。",
    showFileInput: false,
    renderCreatePanel: (ctx) => (
      <WechatThemeSpecPanel
        file={ctx.file}
        onFileChange={ctx.onFileChange}
        cardTitle={ctx.previewTitle}
      />
    ),
    renderEditPanel: (ctx) => (
      <WechatThemeSpecPanel
        file={null}
        onFileChange={(file) => {
          if (file) {
            ctx.onFileChange(file);
          }
        }}
        existingTheme={ctx.loadedCard?.wechatTheme}
        cardTitle={ctx.loadedCard?.card.title}
        disabled={ctx.disabled}
      />
    ),
  },
  {
    slot: "app",
    label: "App",
    accept: undefined,
    description: "App 分类文件。",
    showFileInput: true,
    renderCreatePanel: () => null,
    renderEditPanel: () => null,
  },
  {
    slot: "desktop_component",
    label: "桌面组件",
    accept: ".html,.htm,text/html",
    description: "桌面组件会校验 HTML 文件格式，并读取 <meta name=\"widget-*\"> 标签作为组件配置。",
    editDescription: "替换桌面组件时会校验 HTML 文件格式并重新读取组件配置。",
    showFileInput: true,
    renderCreatePanel: (ctx) => (
      <DesktopComponentSpecPanel file={ctx.file} onFileChange={ctx.onFileChange} />
    ),
    renderEditPanel: () => null,
  },
  {
    slot: "world_book",
    label: "世界书",
    accept: ".json",
    description: "世界书支持直接上传 `.json`，也可以通过下方表单一键生成。",
    showFileInput: false,
    renderCreatePanel: (ctx) => (
      <WorldBookSpecPanel file={ctx.file} onFileChange={ctx.onFileChange} />
    ),
    renderEditPanel: (ctx) => (
      <WorldBookSpecPanel
        file={null}
        onFileChange={(file) => {
          if (file) {
            ctx.onFileChange(file);
          }
        }}
        existingDownloadUrl={ctx.asset?.downloadUrl}
        disabled={ctx.disabled}
      />
    ),
  },
  {
    slot: "character_persona",
    label: "角色人设",
    accept: ".json",
    description: "角色人设支持直接上传 `.json`，也可以通过下方表单一键生成。角色世界书无需在此填写。",
    showFileInput: false,
    renderCreatePanel: (ctx) => (
      <CharacterPersonaSpecPanel file={ctx.file} onFileChange={ctx.onFileChange} />
    ),
    renderEditPanel: (ctx) => (
      <CharacterPersonaSpecPanel
        file={null}
        onFileChange={(file) => {
          if (file) {
            ctx.onFileChange(file);
          }
        }}
        existingDownloadUrl={ctx.asset?.downloadUrl}
        disabled={ctx.disabled}
      />
    ),
  },
];

const slotMap = new Map<CardContentSlot, SlotDefinition>(slots.map((s) => [s.slot, s]));

export const slotOptions: Array<{ value: CardContentSlot; label: string }> = slots.map(
  (definition) => ({ value: definition.slot, label: definition.label }),
);

export const slotLabelMap: Record<CardContentSlot, string> = {
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
  desktop_component: "桌面组件",
};

export function getSlotDefinitions(): SlotDefinition[] {
  return slots;
}

export function getSlotDefinition(slot: CardContentSlot | string): SlotDefinition | undefined {
  return slotMap.get(slot as CardContentSlot);
}

export function getSlotLabel(slot: CardContentSlot | string): string {
  return getSlotDefinition(slot)?.label ?? String(slot);
}

export function getEnabledSlotDefinitions(enabledSlots?: Set<CardContentSlot>): SlotDefinition[] {
  if (!enabledSlots) {
    return slots;
  }
  return slots.filter((s) => enabledSlots.has(s.slot));
}
