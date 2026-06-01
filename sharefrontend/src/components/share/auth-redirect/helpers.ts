export function normalizeNextPath(nextPath: string | undefined) {
  const value = (nextPath ?? "").trim();
  if (!value) {
    return "/creator";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/creator";
  }

  return value;
}
