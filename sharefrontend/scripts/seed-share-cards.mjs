#!/usr/bin/env node

/**
 * Batch create public cards for virtual-list testing.
 *
 * Usage (PowerShell):
 *   npm run seed:cards -- --count 200 --email admin@example.com --password Admin@123456
 *   npm run seed:cards -- --count 500 --base-url http://127.0.0.1:8081 --title-prefix "虚拟列表压测"
 *
 * Notes:
 * - Requires backend share API running.
 * - Auth uses /api/share/auth/continue.
 * - Creates bundle cards via /api/share/me/admin/cards with 5 category files per card.
 */

import { randomUUID } from "node:crypto";

const DEFAULT_BASE_URL = "http://127.0.0.1:8081";
const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_PASSWORD = "Admin@123456";
const CATEGORY_SLOTS = ["system_theme", "wechat_theme", "app", "character_persona", "world_book"];

function parseArgs(argv) {
  const options = {
    count: 120,
    baseUrl: DEFAULT_BASE_URL,
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
    titlePrefix: "虚拟列表压测卡片",
    descriptionPrefix: "用于首页虚拟列表与分页懒加载联合测试",
    visibility: "public",
    status: "published",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      if (key === "help" || key === "h") {
        options.help = true;
      }
      continue;
    }

    i += 1;
    switch (key) {
      case "count":
        options.count = Number.parseInt(value, 10);
        break;
      case "base-url":
        options.baseUrl = value;
        break;
      case "email":
        options.email = value;
        break;
      case "password":
        options.password = value;
        break;
      case "title-prefix":
        options.titlePrefix = value;
        break;
      case "description-prefix":
        options.descriptionPrefix = value;
        break;
      case "visibility":
        options.visibility = value;
        break;
      case "status":
        options.status = value;
        break;
      default:
        break;
    }
  }

  return options;
}

function printHelp() {
  const lines = [
    "Batch create share cards for virtual list testing",
    "",
    "Options:",
    "  --count <number>              Number of cards to create (default: 120)",
    "  --base-url <url>              Backend base URL (default: http://127.0.0.1:8081)",
    "  --email <email>               Login email (default: admin@example.com)",
    "  --password <password>         Login password (default: Admin@123456)",
    '  --title-prefix <text>         Card title prefix (default: "虚拟列表压测卡片")',
    '  --description-prefix <text>   Card description prefix',
    "  --visibility <public|private> Card visibility (default: public)",
    "  --status <published|draft|archived> Card status (default: published)",
    "  --help                        Show help",
    "",
    "Example:",
    "  npm run seed:cards -- --count 300 --email admin@example.com --password Admin@123456",
  ];
  console.log(lines.join("\n"));
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function assertOptions(options) {
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error("--count 必须是大于 0 的整数");
  }
  if (!options.email || !String(options.email).includes("@")) {
    throw new Error("--email 不是有效邮箱");
  }
  if (!options.password || String(options.password).length < 6) {
    throw new Error("--password 至少 6 位");
  }
  if (!["public", "private"].includes(options.visibility)) {
    throw new Error("--visibility 只能是 public 或 private");
  }
  if (!["published", "draft", "archived"].includes(options.status)) {
    throw new Error("--status 只能是 published、draft 或 archived");
  }
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function loginAndGetCookie(baseUrl, email, password) {
  const url = `${baseUrl}/api/share/auth/continue`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message = payload?.error || `登录失败: HTTP ${response.status}`;
    throw new Error(message);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("登录成功但未返回会话 Cookie（set-cookie）");
  }

  const sessionCookie = setCookie.split(";")[0];
  if (!sessionCookie.includes("=")) {
    throw new Error("无法解析会话 Cookie");
  }

  return sessionCookie;
}

function buildTextFileContent(cardIndex, slot) {
  const now = new Date().toISOString();
  return [
    `# ${slot}`,
    `card_index: ${cardIndex}`,
    `generated_at: ${now}`,
    "This file is generated for sharefrontend virtual-list testing.",
    `seed_id: ${randomUUID()}`,
  ].join("\n");
}

function buildCoverSvg(cardIndex) {
  const hue = (cardIndex * 29) % 360;
  const hue2 = (hue + 40) % 360;
  const text = `Card ${cardIndex}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 82%, 72%)"/>
      <stop offset="100%" stop-color="hsl(${hue2}, 85%, 60%)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <circle cx="180" cy="160" r="120" fill="rgba(255,255,255,0.25)"/>
  <circle cx="1020" cy="740" r="180" fill="rgba(255,255,255,0.2)"/>
  <text x="80" y="780" font-size="96" font-weight="800" fill="#1f1f33" font-family="Arial, sans-serif">${text}</text>
</svg>`;
}

function buildBundleFormData(options, cardIndex) {
  const formData = new FormData();
  const items = [];

  CATEGORY_SLOTS.forEach((slot, idx) => {
    const fileField = `file_${idx}`;
    const fileContent = buildTextFileContent(cardIndex, slot);
    const fileName = `${slot}-${String(cardIndex).padStart(4, "0")}.txt`;
    const file = new File([fileContent], fileName, { type: "text/plain" });
    formData.append(fileField, file);
    items.push({ slot, fileField });
  });

  const payload = {
    title: `${options.titlePrefix} ${String(cardIndex).padStart(4, "0")}`,
    description: `${options.descriptionPrefix} #${cardIndex}`,
    visibility: options.visibility,
    status: options.status,
    items,
  };
  formData.append("payload", JSON.stringify(payload));

  const coverSvg = buildCoverSvg(cardIndex);
  const coverFile = new File([coverSvg], `cover-${String(cardIndex).padStart(4, "0")}.svg`, {
    type: "image/svg+xml",
  });
  formData.append("cover", coverFile);

  return formData;
}

async function createOneCard(baseUrl, sessionCookie, options, cardIndex) {
  const url = `${baseUrl}/api/share/me/admin/cards`;
  const body = buildBundleFormData(options, cardIndex);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
    },
    body,
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message = payload?.error || `创建失败: HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload?.card?.id || "";
}

function formatDuration(startMs, endMs) {
  const total = Math.max(0, endMs - startMs);
  const sec = (total / 1000).toFixed(2);
  return `${sec}s`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  assertOptions(options);
  options.baseUrl = normalizeBaseUrl(options.baseUrl);

  console.log(`[seed] baseUrl=${options.baseUrl}`);
  console.log(`[seed] count=${options.count}, visibility=${options.visibility}, status=${options.status}`);
  console.log(`[seed] login as ${options.email}`);

  const startedAt = Date.now();
  const sessionCookie = await loginAndGetCookie(options.baseUrl, options.email, options.password);
  console.log("[seed] login success");

  let success = 0;
  let failed = 0;
  const failedItems = [];

  for (let i = 1; i <= options.count; i += 1) {
    try {
      const cardId = await createOneCard(options.baseUrl, sessionCookie, options, i);
      success += 1;
      if (i % 10 === 0 || i === options.count) {
        console.log(`[seed] progress ${i}/${options.count}, success=${success}, failed=${failed}`);
      }
      if (cardId && i <= 3) {
        console.log(`[seed] sample card id: ${cardId}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failedItems.push({ index: i, message });
      console.error(`[seed] failed at #${i}: ${message}`);
    }
  }

  const endedAt = Date.now();
  console.log("");
  console.log(`[seed] done in ${formatDuration(startedAt, endedAt)}`);
  console.log(`[seed] result: success=${success}, failed=${failed}`);

  if (failedItems.length > 0) {
    console.log("[seed] failed details:");
    for (const item of failedItems.slice(0, 20)) {
      console.log(`  - #${item.index}: ${item.message}`);
    }
    if (failedItems.length > 20) {
      console.log(`  - ... and ${failedItems.length - 20} more`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] fatal: ${message}`);
  process.exitCode = 1;
});

