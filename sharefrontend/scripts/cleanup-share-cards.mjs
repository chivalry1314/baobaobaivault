#!/usr/bin/env node

/**
 * Cleanup seeded share cards created by scripts/seed-share-cards.mjs
 *
 * Safe by default:
 * - Default mode is preview only (no deletion).
 * - Add --execute to perform deletions.
 *
 * Usage:
 *   npm run cleanup:cards -- --email admin@example.com --password Admin@123456
 *   npm run cleanup:cards -- --execute --count 200
 *   npm run cleanup:cards -- --execute --title-prefix "虚拟列表压测卡片"
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8081";
const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_PASSWORD = "Admin@123456";
const DEFAULT_TITLE_PREFIX = "虚拟列表压测卡片";
const DEFAULT_DESCRIPTION_PREFIX = "用于首页虚拟列表与分页懒加载联合测试";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
    titlePrefix: DEFAULT_TITLE_PREFIX,
    descriptionPrefix: DEFAULT_DESCRIPTION_PREFIX,
    count: 0,
    execute: false,
    matchTitleOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    const hasValue = value !== undefined && !value.startsWith("--");

    if (key === "execute") {
      options.execute = true;
      continue;
    }
    if (key === "match-title-only") {
      options.matchTitleOnly = true;
      continue;
    }
    if (key === "help" || key === "h") {
      options.help = true;
      continue;
    }
    if (!hasValue) {
      continue;
    }

    i += 1;
    switch (key) {
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
      case "count":
        options.count = Number.parseInt(value, 10);
        break;
      default:
        break;
    }
  }

  return options;
}

function printHelp() {
  const lines = [
    "Cleanup seeded share cards",
    "",
    "Options:",
    "  --base-url <url>              Backend base URL (default: http://127.0.0.1:8081)",
    "  --email <email>               Login email (default: admin@example.com)",
    "  --password <password>         Login password (default: Admin@123456)",
    '  --title-prefix <text>         Match title startsWith this prefix (default: "虚拟列表压测卡片")',
    '  --description-prefix <text>   Match description startsWith this prefix',
    "  --match-title-only            Only match by title prefix (less strict)",
    "  --count <n>                   Delete first n matched cards (0 means all matched)",
    "  --execute                     Actually delete (without this flag = preview only)",
    "  --help                        Show help",
    "",
    "Examples:",
    "  npm run cleanup:cards -- --email admin@example.com --password Admin@123456",
    "  npm run cleanup:cards -- --execute --count 100",
    '  npm run cleanup:cards -- --execute --title-prefix "虚拟列表压测卡片"',
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
  if (!options.email || !String(options.email).includes("@")) {
    throw new Error("--email 不是有效邮箱");
  }
  if (!options.password || String(options.password).length < 6) {
    throw new Error("--password 至少 6 位");
  }
  if (options.count < 0 || !Number.isInteger(options.count)) {
    throw new Error("--count 必须是 >= 0 的整数");
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
  const response = await fetch(`${baseUrl}/api/share/auth/continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload?.error || `登录失败: HTTP ${response.status}`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("登录成功但未返回会话 Cookie（set-cookie）");
  }
  const cookie = setCookie.split(";")[0];
  if (!cookie.includes("=")) {
    throw new Error("无法解析会话 Cookie");
  }
  return cookie;
}

async function fetchMyCards(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/share/me/cards`, {
    headers: {
      Cookie: cookie,
    },
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload?.error || `查询卡片失败: HTTP ${response.status}`);
  }
  return Array.isArray(payload?.cards) ? payload.cards : [];
}

function matchesSeedCard(item, options) {
  const title = String(item?.card?.title || "").trim();
  const description = String(item?.card?.description || "").trim();
  const titleMatch = title.startsWith(options.titlePrefix);
  if (!titleMatch) {
    return false;
  }

  if (options.matchTitleOnly) {
    return true;
  }

  if (!options.descriptionPrefix) {
    return true;
  }
  return description.startsWith(options.descriptionPrefix);
}

async function deleteCard(baseUrl, cookie, cardId) {
  const response = await fetch(`${baseUrl}/api/share/me/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
    headers: {
      Cookie: cookie,
    },
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload?.error || `删除失败: HTTP ${response.status}`);
  }
}

function formatDuration(startMs, endMs) {
  const sec = Math.max(0, endMs - startMs) / 1000;
  return `${sec.toFixed(2)}s`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  assertOptions(options);
  options.baseUrl = normalizeBaseUrl(options.baseUrl);

  console.log(`[cleanup] baseUrl=${options.baseUrl}`);
  console.log(`[cleanup] titlePrefix=${options.titlePrefix}`);
  console.log(`[cleanup] mode=${options.execute ? "DELETE" : "PREVIEW"}`);

  const startedAt = Date.now();
  const cookie = await loginAndGetCookie(options.baseUrl, options.email, options.password);
  const allCards = await fetchMyCards(options.baseUrl, cookie);
  const matched = allCards.filter((item) => matchesSeedCard(item, options));
  const picked = options.count > 0 ? matched.slice(0, options.count) : matched;

  console.log(`[cleanup] myCards=${allCards.length}, matched=${matched.length}, selected=${picked.length}`);
  picked.slice(0, 10).forEach((item, idx) => {
    console.log(`  [${idx + 1}] ${item.card.id} | ${item.card.title}`);
  });
  if (picked.length > 10) {
    console.log(`  ... 还有 ${picked.length - 10} 张`);
  }

  if (!options.execute) {
    console.log("[cleanup] 预览完成。若确认删除，请追加 --execute");
    return;
  }

  let success = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < picked.length; i += 1) {
    const item = picked[i];
    try {
      await deleteCard(options.baseUrl, cookie, item.card.id);
      success += 1;
      if ((i + 1) % 10 === 0 || i + 1 === picked.length) {
        console.log(`[cleanup] progress ${i + 1}/${picked.length}, success=${success}, failed=${failed}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ id: item.card.id, message });
      console.error(`[cleanup] failed ${item.card.id}: ${message}`);
    }
  }

  const endedAt = Date.now();
  console.log("");
  console.log(`[cleanup] done in ${formatDuration(startedAt, endedAt)}`);
  console.log(`[cleanup] result: success=${success}, failed=${failed}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[cleanup] fatal: ${message}`);
  process.exitCode = 1;
});

