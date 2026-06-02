"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { shareApi } from "@/lib/share-api";
import type { ExternalSessionUser, SessionResponse } from "@/lib/shared";

type ShareSessionContextValue = {
  user: ExternalSessionUser | null;
  authenticated: boolean;
  sessionChecking: boolean;
  refreshSession: () => Promise<ExternalSessionUser | null>;
  setUser: (user: ExternalSessionUser | null) => void;
  clearSession: () => void;
};

const ShareSessionContext = createContext<ShareSessionContextValue | null>(null);

export function ShareSessionProvider(props: {
  initialSession?: SessionResponse;
  children: ReactNode;
}) {
  const { initialSession, children } = props;
  const [user, setUserState] = useState<ExternalSessionUser | null>(
    initialSession?.authenticated ? initialSession.user : null,
  );
  const [sessionChecking, setSessionChecking] = useState(
    initialSession === undefined,
  );
  const bootstrappedRef = useRef(false);

  const setUser = useCallback((nextUser: ExternalSessionUser | null) => {
    setUserState(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    setUserState(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setSessionChecking(true);
    try {
      const session = await shareApi.session();
      const nextUser = session.authenticated ? session.user : null;
      setUserState(nextUser);
      return nextUser;
    } catch {
      setUserState(null);
      return null;
    } finally {
      setSessionChecking(false);
    }
  }, []);

  useEffect(() => {
    if (initialSession !== undefined || bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    void refreshSession();
  }, [initialSession, refreshSession]);

  const value = useMemo(
    () => ({
      user,
      authenticated: Boolean(user),
      sessionChecking,
      refreshSession,
      setUser,
      clearSession,
    }),
    [clearSession, refreshSession, sessionChecking, setUser, user],
  );

  return (
    <ShareSessionContext.Provider value={value}>
      {children}
    </ShareSessionContext.Provider>
  );
}

export function useShareSession() {
  const context = useContext(ShareSessionContext);
  if (!context) {
    throw new Error(
      "useShareSession must be used within ShareSessionProvider",
    );
  }

  return context;
}
