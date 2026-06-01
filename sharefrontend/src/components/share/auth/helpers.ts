export function getSafeRedirectPath(value: string | null, fallback: string) {
  const nextPath = (value ?? "").trim();
  if (!nextPath) {
    return fallback;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  return nextPath;
}
