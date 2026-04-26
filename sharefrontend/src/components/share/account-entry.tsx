"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const username = user.username.trim();
  if (username) {
    return username;
  }

  const emailName = user.email.split("@")[0]?.trim();
  return emailName || "Card Share";
}

function getInitials(user: ExternalSessionUser) {
  return Array.from(getDisplayName(user)).slice(0, 2).join("").toUpperCase() || "CS";
}

export function AccountEntry() {
  const router = useRouter();
  const [user, setUser] = useState<ExternalSessionUser | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        setUser(session.authenticated ? session.user : null);
      } catch {
        if (!active) {
          return;
        }

        setUser(null);
      } finally {
        if (active) {
          setSessionResolved(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (sessionResolved) {
      return;
    }

    event.preventDefault();

    if (navigating) {
      return;
    }

    setNavigating(true);

    try {
      const session = await shareApi.session();
      const authenticated = Boolean(session.authenticated && session.user);

      setUser(authenticated ? session.user : null);
      router.push(authenticated ? "/creator" : "/login");
      router.refresh();
    } catch {
      setUser(null);
      router.push("/login");
    } finally {
      setSessionResolved(true);
      setNavigating(false);
    }
  }

  const href = user ? "/creator" : "/login";
  const label = user ? "进入个人主页" : "登录或注册";
  const title = user ? `${getDisplayName(user)} 的主页` : "登录或注册";

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-label={label}
      title={title}
      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-container-low)] text-[var(--brand)] shadow-[0_12px_28px_-18px_rgba(241,93,135,0.55)] transition hover:scale-[1.03] hover:bg-[var(--surface-container)]"
    >
      {user?.avatar.trim() ? (
        <img src={user.avatar} alt={getDisplayName(user)} className="h-full w-full object-cover" />
      ) : user ? (
        <span className="text-sm font-semibold text-[var(--primary)]">{getInitials(user)}</span>
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
