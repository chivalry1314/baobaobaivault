import { NextResponse } from "next/server";

const cardThemes: Record<string, [string, string]> = {
  "demo-sakura": ["#f5cad6", "#f8d9ec"],
  "demo-sunset": ["#f9d2a7", "#f5b2c8"],
  "demo-rose": ["#f5b7c7", "#f9d8b4"],
  "demo-crystal": ["#cfe8ff", "#d9d1ff"],
  "demo-moon": ["#bfcff1", "#dde6ff"],
  "demo-flower": ["#cbe8d5", "#f6d7c8"],
};

const avatarThemes: Record<string, [string, string]> = {
  "avatar-sakura": ["#f2c6d4", "#f7dff0"],
  "avatar-sunset": ["#f8c9a4", "#f6b7c8"],
  "avatar-rose": ["#f3b3c5", "#f8d5bb"],
  "avatar-crystal": ["#cce4ff", "#d8d0ff"],
  "avatar-moon": ["#c3d2f2", "#e1e8ff"],
  "avatar-flower": ["#c7e5d2", "#f5d8c8"],
};

const labels: Record<string, string> = {
  "demo-sakura": "Sakura",
  "demo-sunset": "Sunset",
  "demo-rose": "Rose",
  "demo-crystal": "Crystal",
  "demo-moon": "Moon",
  "demo-flower": "Flower",
  "avatar-sakura": "SA",
  "avatar-sunset": "SU",
  "avatar-rose": "RO",
  "avatar-crystal": "CR",
  "avatar-moon": "MO",
  "avatar-flower": "FL",
};

function clampDimension(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (token) => {
    switch (token) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&#39;";
      case "\"":
        return "&quot;";
      default:
        return token;
    }
  });
}

function escapeHeaderFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "avatar" ? "avatar" : "card";
  const requestedId = searchParams.get("id") || "";
  const fallbackId = kind === "avatar" ? "avatar-sakura" : "demo-sakura";
  const safeId = (kind === "avatar" ? avatarThemes : cardThemes)[requestedId] ? requestedId : fallbackId;

  const width = clampDimension(searchParams.get("w"), kind === "avatar" ? 240 : 900, kind === "avatar" ? 64 : 320, kind === "avatar" ? 1200 : 2400);
  const height = clampDimension(searchParams.get("h"), kind === "avatar" ? 240 : 1300, kind === "avatar" ? 64 : 480, kind === "avatar" ? 1200 : 3200);
  const download = searchParams.get("download") === "1";

  const [colorStart, colorEnd] = (kind === "avatar" ? avatarThemes : cardThemes)[safeId];
  const label = escapeXml(labels[safeId] ?? "CardShare");
  const fontSize = kind === "avatar" ? Math.max(20, Math.round(Math.min(width, height) * 0.22)) : Math.max(24, Math.round(Math.min(width, height) * 0.11));
  const textY = kind === "avatar" ? Math.round(height * 0.56) : Math.round(height * 0.5);
  const radius = kind === "avatar" ? "9999" : "32";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colorStart}" />
      <stop offset="100%" stop-color="${colorEnd}" />
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)" rx="${radius}" ry="${radius}" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" rx="${radius}" ry="${radius}" />
  <text
    x="${Math.round(width / 2)}"
    y="${textY}"
    text-anchor="middle"
    fill="#ffffff"
    font-family="PingFang SC, Microsoft YaHei, Segoe UI, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    letter-spacing="${kind === "avatar" ? "1" : "2"}"
  >
    ${label}
  </text>
  <text
    x="${Math.round(width / 2)}"
    y="${textY + (kind === "avatar" ? Math.round(fontSize * 0.95) : Math.round(fontSize * 1.1))}"
    text-anchor="middle"
    fill="rgba(255,255,255,0.78)"
    font-family="PingFang SC, Microsoft YaHei, Segoe UI, Arial, sans-serif"
    font-size="${Math.max(12, Math.round(fontSize * 0.32))}"
    font-weight="500"
    letter-spacing="1.4"
  >
    CardShare
  </text>
</svg>`;

  const headers = new Headers({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });

  if (download) {
    const filename = escapeHeaderFilename(`${safeId}-${width}x${height}.svg`);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  }

  return new NextResponse(svg, { status: 200, headers });
}
