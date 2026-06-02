import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { useShareSession } from "@/components/share/session-provider";

export function useAccountEntry() {
  const router = useRouter();
  const { user, sessionChecking, refreshSession } = useShareSession();
  const [navigating, setNavigating] = useState(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (user) {
      return;
    }

    event.preventDefault();

    if (navigating || sessionChecking) {
      return;
    }

    setNavigating(true);

    try {
      const nextUser = await refreshSession();
      router.push(nextUser ? "/creator" : "/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setNavigating(false);
    }
  }

  return {
    user,
    sessionResolved: !sessionChecking,
    navigating,
    href: user ? "/creator" : "/login",
    handleClick,
  };
}
