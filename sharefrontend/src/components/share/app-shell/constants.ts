import type { NavItem } from "@/components/share/app-shell/types";

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "首页" },
  { href: "/creator/new", label: "创作中心" },
  { href: "/creator/reviews", label: "审核中心", managerOnly: true },
  { href: "/system", label: "系统管理", superAdminOnly: true },
];
