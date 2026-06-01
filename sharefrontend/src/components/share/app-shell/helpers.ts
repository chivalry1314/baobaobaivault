export function isNavItemActive(currentPath: string, href: string) {
  if (href.startsWith("/creator")) {
    return currentPath.startsWith("/creator");
  }
  return currentPath === href;
}
