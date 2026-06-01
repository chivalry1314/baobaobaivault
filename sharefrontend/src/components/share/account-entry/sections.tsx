import Link from "next/link";
import type { MouseEvent } from "react";

import {
  getDisplayName,
  getEntryLabel,
  getEntryTitle,
  getInitials,
} from "@/components/share/account-entry/helpers";
import type { ExternalSessionUser } from "@/lib/shared";

export function AccountEntryButton(props: {
  user: ExternalSessionUser | null;
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { user, href, onClick } = props;
  const label = getEntryLabel(user);
  const title = getEntryTitle(user);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      title={title}
      className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--outline)] bg-[#fcb4c7] text-[var(--foreground)] transition-all hover:opacity-90 sm:h-14 sm:w-14"
    >
      {user?.avatar.trim() ? (
        <img src={user.avatar} alt={getDisplayName(user)} className="h-full w-full object-cover" />
      ) : user ? (
        <span className="text-sm font-black leading-none text-[var(--foreground)]/78">
          {getInitials(user)}
        </span>
      ) : (
        <UserIcon />
      )}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 4.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.75 8.25a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Zm2.25 5.25c-3.59 0-6.5 2.24-6.5 5v.75h13v-.75c0-2.76-2.91-5-6.5-5Zm-4.88 4.25c.48-1.58 2.39-2.75 4.88-2.75 2.49 0 4.4 1.17 4.88 2.75H7.12Z"
        fill="currentColor"
      />
    </svg>
  );
}
