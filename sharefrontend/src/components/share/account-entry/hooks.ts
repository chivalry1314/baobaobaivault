import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

export function useAccountEntry() {
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

  return {
    user,
    sessionResolved,
    navigating,
    href: user ? "/creator" : "/login",
    handleClick,
  };
}
