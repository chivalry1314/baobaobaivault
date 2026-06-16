import JSZip from "jszip";

import {
  wechatThemeImageExtensions,
  wechatThemeMaxFileSize,
  wechatThemeMaxZipFiles,
  wechatThemeMetaDefaults,
  type WechatThemeBubblePreset,
  type WechatThemeMetadata,
} from "@/components/share/card-editor/constants";

export type WechatThemePackageSticker = {
  id: string;
  name: string;
  file: string;
};

export type WechatThemePackageStickerPack = {
  id: string;
  name: string;
  cover?: string;
  stickers: WechatThemePackageSticker[];
};

export type WechatThemePackageDescriptor = {
  id?: string;
  name?: string;
  author?: string;
  version?: string;
  description?: string;
  tags?: string[];
  chatBackgroundImage?: string;
  chatBackgroundOpacity?: number;
  selfBubblePreset?: WechatThemeBubblePreset;
  peerBubblePreset?: WechatThemeBubblePreset;
  rendererSource?: string;
  stickerPacks?: WechatThemePackageStickerPack[];
  features?: string[];
};

export type WechatThemeValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: Partial<WechatThemePackageDescriptor>;
  format: "zip" | "json" | "unknown";
};

const VALID_BUBBLE_PRESETS: WechatThemeBubblePreset[] = ["wechat", "rounded", "glass", "outline"];

const isValidBubblePreset = (value: string): value is WechatThemeBubblePreset =>
  VALID_BUBBLE_PRESETS.includes(value as WechatThemeBubblePreset);

const normalizeBubblePreset = (value: string | undefined): WechatThemeBubblePreset => {
  const normalized = (value || "wechat").trim().toLowerCase();
  return isValidBubblePreset(normalized) ? normalized : "wechat";
};

const normalizePath = (input: string): string =>
  input
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

const dirname = (input: string): string => {
  const normalized = normalizePath(input);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
};

const joinPath = (baseDir: string, target: string): string => {
  const rawSegments = `${baseDir ? `${baseDir}/` : ""}${target}`.split("/").filter(Boolean);
  const resolved: string[] = [];

  rawSegments.forEach((segment) => {
    if (segment === ".") return;
    if (segment === "..") {
      if (!resolved.length) {
        throw new Error("主题包资源路径无效，不能越级访问上级目录。");
      }
      resolved.pop();
      return;
    }
    resolved.push(segment);
  });

  return resolved.join("/");
};

const getFileExtension = (fileName: string): string => {
  const normalized = normalizePath(fileName).toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
};

const isImageExtension = (fileName: string): boolean =>
  wechatThemeImageExtensions.includes(getFileExtension(fileName) as (typeof wechatThemeImageExtensions)[number]);

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  value.forEach((item) => {
    const tag = String(item).trim();
    if (!tag) return;
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(tag);
  });

  return result;
};

const normalizeStickerPacks = (value: unknown): WechatThemePackageStickerPack[] => {
  if (!Array.isArray(value)) return [];
  const packSeen = new Set<string>();
  const packs: WechatThemePackageStickerPack[] = [];

  value.forEach((rawPack) => {
    if (!rawPack || typeof rawPack !== "object") return;
    const pack = rawPack as Record<string, unknown>;
    const id = String(pack.id || "").trim();
    const name = String(pack.name || "").trim();
    if (!id || !name || packSeen.has(id)) return;
    packSeen.add(id);

    const stickerSeen = new Set<string>();
    const stickers: WechatThemePackageSticker[] = [];
    const rawStickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    rawStickers.forEach((rawSticker) => {
      if (!rawSticker || typeof rawSticker !== "object") return;
      const sticker = rawSticker as Record<string, unknown>;
      const sid = String(sticker.id || "").trim();
      const sname = String(sticker.name || "").trim();
      const file = String(sticker.file || "").trim();
      if (!sid || !sname || !file || stickerSeen.has(sid)) return;
      stickerSeen.add(sid);
      stickers.push({ id: sid, name: sname, file });
    });

    packs.push({
      id,
      name,
      cover: String(pack.cover || "").trim() || undefined,
      stickers,
    });
  });

  return packs;
};

const normalizeDescriptor = (raw: unknown): WechatThemePackageDescriptor => {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    id: String(input.id || "").trim(),
    name: String(input.name || "").trim(),
    author: String(input.author || "").trim(),
    version: String(input.version || "").trim(),
    description: String(input.description || "").trim(),
    tags: normalizeTags(input.tags),
    chatBackgroundImage: String(input.chatBackgroundImage || "").trim(),
    chatBackgroundOpacity: Math.max(
      0,
      Math.min(1, Number(input.chatBackgroundOpacity) || 0),
    ),
    selfBubblePreset: normalizeBubblePreset(String(input.selfBubblePreset || "")),
    peerBubblePreset: normalizeBubblePreset(String(input.peerBubblePreset || "")),
    rendererSource: String(input.rendererSource || "").trim(),
    stickerPacks: normalizeStickerPacks(input.stickerPacks),
  };
};

export function detectWechatThemeFormat(file: File | null): "zip" | "json" | "unknown" {
  if (!file) return "unknown";

  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return "zip";
  if (name.endsWith(".json")) return "json";

  const type = (file.type || "").toLowerCase();
  if (type === "application/zip" || type === "application/x-zip-compressed") return "zip";
  if (type === "application/json" || type === "text/json") return "json";

  return "unknown";
}

function parseJsonSafe<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function validateDescriptor(descriptor: WechatThemePackageDescriptor): Promise<{
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (descriptor.name && descriptor.name.length > 120) {
    warnings.push("主题名称过长，建议控制在 120 字以内。");
  }

  if ((descriptor.description || "").length > 500) {
    warnings.push("描述过长，建议控制在 500 字以内。");
  }

  if ((descriptor.tags || []).length > 12) {
    warnings.push("标签数量超过 12 个，多余标签将被忽略。");
  }

  return { errors, warnings };
}

async function validateWechatThemeJson(file: File): Promise<WechatThemeValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const text = await file.text();
  const raw = parseJsonSafe<Record<string, unknown>>(text);

  if (raw === null) {
    errors.push("JSON 文件解析失败，请检查格式。");
    return { valid: false, errors, warnings, parsed: {}, format: "json" };
  }

  const descriptor = normalizeDescriptor(raw);
  const validation = await validateDescriptor(descriptor);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  if (descriptor.chatBackgroundImage) {
    const image = descriptor.chatBackgroundImage;
    if (image.toLowerCase().startsWith("data:")) {
      warnings.push("聊天背景图为 base64 内联，文件体积可能较大。");
    } else if (/^https?:\/\//i.test(image)) {
      warnings.push("主题包引用了外部远程资源，下载后可能无法离线使用。");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: descriptor,
    format: "json",
  };
}

async function validateWechatThemeZip(file: File): Promise<WechatThemeValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    errors.push("无法解析 ZIP 文件。");
    return { valid: false, errors, warnings, parsed: {}, format: "zip" };
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  if (entries.length === 0) {
    errors.push("ZIP 文件为空。");
    return { valid: false, errors, warnings, parsed: {}, format: "zip" };
  }

  if (entries.length > wechatThemeMaxZipFiles) {
    errors.push(`ZIP 内文件数量超过 ${wechatThemeMaxZipFiles} 个。`);
  }

  const entryMap = new Map<string, JSZip.JSZipObject>();
  entries.forEach((entry) => {
    entryMap.set(normalizePath(entry.name).toLowerCase(), entry);
  });

  const manifestEntry =
    zip.file(/(^|\/)manifest\.json$/i)[0] || zip.file(/(^|\/)theme\.json$/i)[0];

  if (!manifestEntry) {
    errors.push("ZIP 中缺少 manifest.json 或 theme.json。");
    return { valid: false, errors, warnings, parsed: {}, format: "zip" };
  }

  let descriptor: WechatThemePackageDescriptor;
  try {
    const manifestText = await manifestEntry.async("string");
    const raw = parseJsonSafe<Record<string, unknown>>(manifestText);
    if (raw === null) {
      errors.push("manifest.json 不是有效的 JSON。");
      return { valid: false, errors, warnings, parsed: {}, format: "zip" };
    }
    descriptor = normalizeDescriptor(raw);
  } catch {
    errors.push("读取 manifest.json 失败。");
    return { valid: false, errors, warnings, parsed: {}, format: "zip" };
  }

  const validation = await validateDescriptor(descriptor);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  const manifestDir = dirname(manifestEntry.name);

  if (descriptor.chatBackgroundImage) {
    const image = descriptor.chatBackgroundImage;
    if (image.toLowerCase().startsWith("data:")) {
      warnings.push("聊天背景图为 base64 内联，文件体积可能较大。");
    } else if (/^https?:\/\//i.test(image)) {
      warnings.push("主题包引用了外部远程资源，下载后可能无法离线使用。");
    } else {
      try {
        const resolved = joinPath(manifestDir, image).toLowerCase();
        const entry = entryMap.get(resolved);
        if (!entry) {
          errors.push(`未找到聊天背景图资源：${image}`);
        } else if (!isImageExtension(resolved)) {
          errors.push(`聊天背景图格式不支持：${image}`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "背景图路径非法。");
      }
    }
  }

  (descriptor.stickerPacks || []).forEach((pack) => {
    if (pack.cover) {
      try {
        const resolved = joinPath(manifestDir, pack.cover).toLowerCase();
        if (!entryMap.has(resolved)) {
          errors.push(`表情包「${pack.name}」封面资源未找到：${pack.cover}`);
        } else if (!isImageExtension(resolved)) {
          errors.push(`表情包「${pack.name}」封面格式不支持：${pack.cover}`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `表情包「${pack.name}」封面路径非法。`);
      }
    }
    pack.stickers.forEach((sticker) => {
      try {
        const resolved = joinPath(manifestDir, sticker.file).toLowerCase();
        if (!entryMap.has(resolved)) {
          errors.push(`表情「${sticker.name}」资源未找到：${sticker.file}`);
        } else if (!isImageExtension(resolved)) {
          errors.push(`表情「${sticker.name}」格式不支持：${sticker.file}`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `表情「${sticker.name}」路径非法。`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: descriptor,
    format: "zip",
  };
}

export async function validateWechatThemeFile(file: File | null): Promise<WechatThemeValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!file) {
    errors.push("未选择文件");
    return {
      valid: false,
      errors,
      warnings,
      parsed: {},
      format: "unknown",
    };
  }

  if (file.size > wechatThemeMaxFileSize) {
    errors.push(`文件大小超过 ${Math.round(wechatThemeMaxFileSize / 1024 / 1024)} MB 限制。`);
  }

  const format = detectWechatThemeFormat(file);

  if (format === "unknown") {
    errors.push("微信主题仅支持 .zip 或 .json 文件。");
    return { valid: false, errors, warnings, parsed: {}, format };
  }

  if (format === "json") {
    return validateWechatThemeJson(file);
  }

  return validateWechatThemeZip(file);
}

export function parseTagInput(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((item) => item.slice(0, 32).trim())
    .filter((item) => item.length > 0);
}

export function formatTagInput(values: string[]): string {
  return values.join(", ");
}

export type WechatThemeBuildFiles = {
  chatBackgroundImage: File | null;
  rendererSourceFile: File | null;
};

export type WechatThemeBuildSections = {
  bubble: boolean;
  background: boolean;
  stickers: boolean;
  renderer: boolean;
};

export const wechatThemeBuildSectionsDefault: WechatThemeBuildSections = {
  bubble: false,
  background: false,
  stickers: false,
  renderer: false,
};

const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80);
};

const getSafeExtension = (fileName: string): string => {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  return ext ? `.${ext}` : "";
};

export async function createCompliantWechatThemeZip(
  metadata: WechatThemeMetadata,
  files: WechatThemeBuildFiles,
  cardTitle?: string,
  sections: WechatThemeBuildSections = wechatThemeBuildSectionsDefault,
): Promise<File> {
  const name = (cardTitle || "").trim();
  if (!name) {
    throw new Error("请先在卡片信息中填写主题名称（卡片标题）。");
  }

  const safeId = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const descriptor: WechatThemePackageDescriptor = {
    id: safeId || undefined,
  };

  if (sections.bubble) {
    descriptor.selfBubblePreset = metadata.selfBubblePreset;
    descriptor.peerBubblePreset = metadata.peerBubblePreset;
  }

  const zip = new JSZip();

  if (sections.background && files.chatBackgroundImage) {
    const imageFile = files.chatBackgroundImage;
    const imageName = imageFile.name || "chat-background.png";
    const imageBuffer = await imageFile.arrayBuffer();
    zip.file(imageName, new Uint8Array(imageBuffer));
    descriptor.chatBackgroundImage = imageName;
    descriptor.chatBackgroundOpacity = Math.max(0, Math.min(1, metadata.chatBackgroundOpacity));
  }

  if (sections.stickers) {
    const packageStickerPacks: WechatThemePackageStickerPack[] = [];
    for (const pack of metadata.stickerPacks || []) {
      const packDir = `stickers/${sanitizeFileName(pack.id)}`;
      const packagePack: WechatThemePackageStickerPack = {
        id: pack.id,
        name: pack.name,
        stickers: [],
      };

      if (pack.cover) {
        const coverName = `cover${getSafeExtension(pack.cover.name) || ".png"}`;
        const coverPath = `${packDir}/${coverName}`;
        const coverBuffer = await pack.cover.arrayBuffer();
        zip.file(coverPath, new Uint8Array(coverBuffer));
        packagePack.cover = coverPath;
      }

      for (const sticker of pack.stickers) {
        if (!sticker.file) continue;
        const stickerName = `${sanitizeFileName(sticker.id)}${getSafeExtension(sticker.file.name) || ".png"}`;
        const stickerPath = `${packDir}/${stickerName}`;
        const stickerBuffer = await sticker.file.arrayBuffer();
        zip.file(stickerPath, new Uint8Array(stickerBuffer));
        packagePack.stickers.push({ id: sticker.id, name: sticker.name, file: stickerPath });
      }

      if (packagePack.stickers.length > 0) {
        packageStickerPacks.push(packagePack);
      }
    }
    if (packageStickerPacks.length > 0) {
      descriptor.stickerPacks = packageStickerPacks;
    }
  }

  if (sections.renderer && metadata.rendererSource.trim()) {
    descriptor.rendererSource = metadata.rendererSource.trim().slice(0, 50000);
  }

  const features: string[] = [];
  if (sections.bubble) features.push("bubble");
  if (sections.background && files.chatBackgroundImage) features.push("background");
  const hasStickers =
    sections.stickers &&
    (metadata.stickerPacks || []).some((pack) => pack.stickers.some((sticker) => sticker.file));
  if (hasStickers) features.push("stickers");
  if (sections.renderer && metadata.rendererSource.trim()) features.push("renderer");
  if (features.length > 0) {
    descriptor.features = features;
  }

  zip.file("manifest.json", JSON.stringify(descriptor, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return new File([blob], "wechat-theme.zip", { type: "application/zip" });
}

export { wechatThemeMetaDefaults };
