export function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseAuditDetail(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") return parseJson(value, {}) || {};
  return {};
}

export function formatAuditValue(value) {
  if (value === undefined) return "（未定义）";
  if (value === null) return "（空）";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function parseOptionalPositiveInt(value) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}
