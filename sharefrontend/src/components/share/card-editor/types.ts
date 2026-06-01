import type { CardContentSlot } from "@/lib/shared";

export type EditorMode = "create" | "edit";
export type CreateMode = "single" | "bundle";
export type AssetOpMode = "replace" | "remove";

export type SubmitMode = "published" | "draft" | "delete" | null;
export type CoverPendingMode = "replace" | "remove" | null;

export type AssetPendingMap = Record<CardContentSlot, AssetOpMode | null>;

export type ShareCardEditorProps = {
  mode: EditorMode;
  cardId?: string;
};
