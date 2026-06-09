export function isNavItemActive(currentPath: string, href: string) {
  if (href === "/creator/new") {
    return currentPath === "/creator" || currentPath.startsWith("/creator/new");
  }

  if (href === "/creator/reviews") {
    return currentPath.startsWith("/creator/reviews");
  }

  if (href === "/system") {
    return currentPath === "/system" || currentPath.startsWith("/system/");
  }

  if (href.startsWith("/creator")) {
    return currentPath.startsWith("/creator");
  }
  return currentPath === href;
}
