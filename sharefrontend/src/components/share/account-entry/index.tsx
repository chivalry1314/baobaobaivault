"use client";

import { useAccountEntry } from "@/components/share/account-entry/hooks";
import { AccountEntryButton } from "@/components/share/account-entry/sections";

export function AccountEntry() {
  const { user, href, navigating, handleClick } = useAccountEntry();
  return <AccountEntryButton user={user} href={href} navigating={navigating} onClick={handleClick} />;
}
