import type { ReactNode } from "react";

export type AppShellProps = {
  currentPath?: string;
  children: ReactNode;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
};

export type NavItem = {
  href: string;
  label: string;
  managerOnly?: boolean;
};
