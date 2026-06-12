"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useShareSession } from "@/components/share/session-provider";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";

export type FavoriteButtonSize = "default" | "compact";

export function FavoriteButton(props: {
  cardId: string;
  initialFavorited?: boolean;
  initialCount?: number;
  size?: FavoriteButtonSize;
  onToggle?: (nextFavorited: boolean, nextCount: number) => void;
}) {
  const { cardId, initialFavorited = false, initialCount = 0, size = "default", onToggle } = props;
  const router = useRouter();
  const { user } = useShareSession();

  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(
    async (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (pending) {
        return;
      }

      const nextFavorited = !favorited;
      const nextCount = Math.max(0, count + (nextFavorited ? 1 : -1));

      setPending(true);
      setFavorited(nextFavorited);
      setCount(nextCount);
      onToggle?.(nextFavorited, nextCount);

      try {
        if (nextFavorited) {
          await shareApi.favoriteCard(cardId);
        } else {
          await shareApi.unfavoriteCard(cardId);
        }
      } catch (error) {
        setFavorited(favorited);
        setCount(count);
        onToggle?.(favorited, count);
        window.alert(getShareErrorMessage(error, "操作失败，请稍后重试。"));
      } finally {
        setPending(false);
      }
    },
    [cardId, count, favorited, onToggle, pending, router, user],
  );

  if (size === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-full border-[3px] border-[var(--outline)] bg-white px-2 py-1 text-xs font-black transition-all ${
          favorited ? "text-[var(--brand)]" : "text-[var(--foreground)]/70"
        } disabled:opacity-60`}
        aria-label={favorited ? "取消收藏" : "收藏"}
      >
        <HeartIcon filled={favorited} className="h-3.5 w-3.5" />
        <span>{count}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-full border-[3px] border-[var(--outline)] bg-white px-4 py-2 text-base font-black transition-all ${
        favorited ? "text-[var(--brand)]" : "text-[var(--foreground)]"
      } disabled:opacity-60`}
      aria-label={favorited ? "取消收藏" : "收藏"}
    >
      <HeartIcon filled={favorited} className="h-5 w-5" />
      <span>{count}</span>
    </button>
  );
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" />
    </svg>
  );
}
