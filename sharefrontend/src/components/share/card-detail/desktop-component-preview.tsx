"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import type { CardDetailResponse } from "@/lib/shared";

type DesktopComponentPreviewProps = {
  detail: CardDetailResponse;
  unlockCode: string;
};

const GRID_CELL_SIZE = 100;

export function DesktopComponentPreview({ detail, unlockCode }: DesktopComponentPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const desktopComponent = detail.desktopComponent;
  const asset = detail.assets.find((a) => a.slot === "desktop_component");
  const assetUrl = asset?.downloadUrl ?? "";

  const loadHtml = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let downloadUrl = assetUrl;
      const isLocalApi = !downloadUrl.startsWith("http");
      if (isLocalApi) {
        downloadUrl = `${window.location.origin}${downloadUrl}`;
      }
      if (isLocalApi) {
        downloadUrl += `${downloadUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      }
      if (unlockCode) {
        downloadUrl += `${downloadUrl.includes("?") ? "&" : "?"}code=${encodeURIComponent(unlockCode)}`;
      }

      const response = await fetch(downloadUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error("组件加载失败");
      }
      const html = await response.text();
      setHtmlContent(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "预览加载失败");
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  }, [assetUrl, unlockCode]);

  useEffect(() => {
    if (!assetUrl) return;
    // 资产发生变化（重新上传/替换）后清空缓存，确保下次预览加载最新文件
    setHtmlContent(null);
    if (expanded) {
      void loadHtml();
    }
  }, [assetUrl, expanded, loadHtml]);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    if (htmlContent) {
      return;
    }
    await loadHtml();
  };

  if (!desktopComponent || !asset) {
    return null;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading}
        className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "加载中..." : expanded ? "收起组件预览" : "预览桌面组件"}
      </button>

      {error ? (
        <div className="mt-2 rounded-[1rem] border border-[#f3c8ad] bg-[#fff4ec] px-3 py-2 text-xs font-black text-[#9a3412]">
          {error}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 overflow-auto rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
          {loading ? (
            <LoadingSpinner label="正在加载组件..." className="min-h-[160px]" />
          ) : htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              title="桌面组件预览"
              sandbox="allow-scripts"
              style={{
                width: Math.max(desktopComponent.width, 1) * GRID_CELL_SIZE,
                height: Math.max(desktopComponent.height, 1) * GRID_CELL_SIZE,
              }}
              className="block rounded-[0.8rem] bg-white"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
