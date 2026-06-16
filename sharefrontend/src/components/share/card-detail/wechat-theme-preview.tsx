"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import type { CardDetailResponse } from "@/lib/shared";

type PreviewSticker = {
  id: string;
  name: string;
  url: string;
};

type PreviewStickerPack = {
  id: string;
  name: string;
  coverUrl: string | null;
  stickers: PreviewSticker[];
};

type WechatThemePreviewData = {
  backgroundUrl: string | null;
  stickerPacks: PreviewStickerPack[];
};

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function getMimeByPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return IMAGE_MIME_BY_EXT[ext] || "image/png";
}

function normalizeZipPath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function dirname(input: string): string {
  const normalized = normalizeZipPath(input);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function joinPath(base: string, target: string): string {
  const raw = `${base ? `${base}/` : ""}${target}`.split("/").filter(Boolean);
  const resolved: string[] = [];
  raw.forEach((segment) => {
    if (segment === ".") return;
    if (segment === "..") {
      if (resolved.length) resolved.pop();
      return;
    }
    resolved.push(segment);
  });
  return resolved.join("/");
}

async function loadWechatThemePreview(
  detail: CardDetailResponse,
  code?: string,
): Promise<WechatThemePreviewData | null> {
  const asset = detail.assets.find((a) => a.slot === "wechat_theme");
  if (!asset) return null;

  let downloadUrl = asset.downloadUrl;
  if (!downloadUrl.startsWith("http")) {
    downloadUrl = `${window.location.origin}${downloadUrl}`;
  }
  if (code) {
    downloadUrl += `${downloadUrl.includes("?") ? "&" : "?"}code=${encodeURIComponent(code)}`;
  }

  try {
    const response = await fetch(downloadUrl, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);

    const entries = Object.values(zip.files).filter((e) => !e.dir);
    const manifestEntry =
      entries.find((e) => /(^|\/)manifest\.json$/i.test(e.name)) ||
      entries.find((e) => /(^|\/)theme\.json$/i.test(e.name));
    if (!manifestEntry) return null;

    const manifestText = await manifestEntry.async("string");
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    const manifestDir = dirname(manifestEntry.name);

    const entryMap = new Map<string, JSZip.JSZipObject>();
    entries.forEach((entry) => {
      entryMap.set(normalizeZipPath(entry.name).toLowerCase(), entry);
    });

    const resolveAsset = async (filePath: string): Promise<string | null> => {
      const trimmed = String(filePath || "").trim();
      if (!trimmed) return null;
      const resolved = joinPath(manifestDir, trimmed).toLowerCase();
      const entry = entryMap.get(resolved);
      if (!entry) return null;
      const mime = getMimeByPath(resolved);
      const base64 = await entry.async("base64");
      return `data:${mime};base64,${base64}`;
    };

    const backgroundUrl = await resolveAsset(String(manifest.chatBackgroundImage || ""));

    const stickerPacks: PreviewStickerPack[] = [];
    const rawPacks = Array.isArray(manifest.stickerPacks) ? manifest.stickerPacks : [];
    for (const rawPack of rawPacks) {
      if (!rawPack || typeof rawPack !== "object") continue;
      const pack = rawPack as Record<string, unknown>;
      const packName = String(pack.name || "未命名表情包");
      const coverUrl = await resolveAsset(String(pack.cover || ""));
      const stickers: PreviewSticker[] = [];
      const rawStickers = Array.isArray(pack.stickers) ? pack.stickers : [];
      for (const rawSticker of rawStickers.slice(0, 18)) {
        if (!rawSticker || typeof rawSticker !== "object") continue;
        const sticker = rawSticker as Record<string, unknown>;
        const url = await resolveAsset(String(sticker.file || ""));
        if (url) {
          stickers.push({
            id: String(sticker.id || Math.random().toString(36).slice(2)),
            name: String(sticker.name || "表情"),
            url,
          });
        }
      }
      if (stickers.length > 0 || coverUrl) {
        stickerPacks.push({
          id: String(pack.id || Math.random().toString(36).slice(2)),
          name: packName,
          coverUrl,
          stickers,
        });
      }
    }

    return { backgroundUrl, stickerPacks };
  } catch (error) {
    console.error("[微信主题预览] 加载失败:", error);
    return null;
  }
}

interface WechatThemePreviewProps {
  detail: CardDetailResponse;
  unlockCode?: string;
}

export function WechatThemePreview({ detail, unlockCode }: WechatThemePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<WechatThemePreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    setLoading(true);
    loadWechatThemePreview(detail, unlockCode).then((result) => {
      if (!active) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [expanded, detail, unlockCode]);

  if (!expanded) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-[1rem] border-2 border-dashed border-[var(--outline)]/30 bg-[var(--surface-container)] py-3 text-sm font-black text-[var(--foreground)]/70 transition hover:bg-[var(--surface-container-high)] hover:text-[var(--foreground)]"
        >
          查看主题内容（聊天背景 / 表情包）
        </button>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between">
      <div className="text-sm font-black text-[var(--foreground)]">主题内容预览</div>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="text-[11px] font-bold text-[var(--foreground)]/60 transition hover:text-[var(--foreground)]"
      >
        收起
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        {header}
        <LoadingSpinner label="正在解析主题内容..." className="mt-3 min-h-[160px]" />
      </div>
    );
  }

  if (!data || (!data.backgroundUrl && data.stickerPacks.length === 0)) {
    return (
      <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
        {header}
        <div className="mt-3 text-xs font-bold text-[var(--foreground)]/55">暂无可预览内容</div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      {header}

      {data.backgroundUrl ? (
        <div className="mt-3">
          <div className="text-[11px] font-bold text-[var(--foreground)]/55">聊天背景</div>
          <div className="mt-2 overflow-hidden rounded-[1rem] border border-[var(--outline)]/12">
            <img
              src={data.backgroundUrl}
              alt="聊天背景预览"
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ) : null}

      {data.stickerPacks.length > 0 ? (
        <div className="mt-4 space-y-4">
          {data.stickerPacks.map((pack) => (
            <div
              key={pack.id}
              className="rounded-[1rem] border border-[var(--outline)]/12 bg-[var(--surface-container)] p-3"
            >
              <div className="flex items-center gap-2">
                {pack.coverUrl ? (
                  <img
                    src={pack.coverUrl}
                    alt={pack.name}
                    className="h-8 w-8 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="text-xs font-black text-[var(--foreground)]">{pack.name}</span>
                <span className="text-[10px] font-bold text-[var(--foreground)]/50">
                  {pack.stickers.length} 个表情
                </span>
              </div>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {pack.stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="aspect-square overflow-hidden rounded-lg bg-white"
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      title={sticker.name}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
