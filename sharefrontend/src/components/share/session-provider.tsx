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

import { getShareErrorMessage, shareApi } from "@/lib/share-api";
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
      <ForcePasswordChangeDialog user={user} setUser={setUser} clearSession={clearSession} />
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

function ForcePasswordChangeDialog(props: {
  user: ExternalSessionUser | null;
  setUser: (user: ExternalSessionUser | null) => void;
  clearSession: () => void;
}) {
  const { user, setUser, clearSession } = props;
  const open = Boolean(user?.forcePasswordChange);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPending(false);
      setError("");
      setSuccess("");
    }
  }, [open]);

  if (!open || !user) {
    return null;
  }

  async function handleSubmit() {
    if (!oldPassword.trim()) {
      setError("请输入当前登录密码。");
      return;
    }
    if (!newPassword.trim()) {
      setError("请输入新密码。");
      return;
    }
    if (newPassword.trim().length < 6) {
      setError("新密码长度至少 6 位。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    const currentUser = user;
    if (!currentUser) {
      setError("当前登录状态已失效，请重新登录后再试。");
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");

    try {
      await shareApi.changePassword({
        oldPassword,
        newPassword,
      });
      const nextUser: ExternalSessionUser = {
        id: currentUser.id,
        email: currentUser.email,
        username: currentUser.username,
        nickname: currentUser.nickname,
        avatar: currentUser.avatar,
        bio: currentUser.bio,
        coverImage: currentUser.coverImage,
        phone: currentUser.phone,
        role: currentUser.role,
        isConfiguredSuperAdmin: currentUser.isConfiguredSuperAdmin,
        forcePasswordChange: false,
        createdAt: currentUser.createdAt,
      };
      setUser(nextUser);
      setSuccess("密码修改成功，已解除首次登录改密限制。");
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "修改密码失败，请稍后重试。"));
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    try {
      await shareApi.logout().catch(() => null);
    } finally {
      clearSession();
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(17,24,39,0.52)] px-4 py-6">
      <div className="w-full max-w-lg rounded-[28px] border border-[rgba(255,255,255,0.78)] bg-[rgba(255,252,249,0.98)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)] backdrop-blur">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--foreground)]/45">安全提示</p>
          <h2 className="mt-3 text-2xl font-black text-[var(--foreground)]">请先修改密码</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
            当前账号使用的是管理员重置后的临时密码。为了账号安全，你需要先设置一个新的个人密码，修改完成后才能继续使用系统。
          </p>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm font-bold text-[#9a3412]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-5 rounded-2xl border border-[#b7dfc8] bg-[#effaf3] px-4 py-3 text-sm font-bold text-[#166534]">
            {success}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">当前密码</span>
            <input
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              className="dream-input w-full px-4 py-3"
              placeholder="请输入当前登录密码"
              autoComplete="current-password"
              disabled={pending || Boolean(success)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">新密码</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="dream-input w-full px-4 py-3"
              placeholder="请输入新密码"
              autoComplete="new-password"
              disabled={pending || Boolean(success)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">确认新密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="dream-input w-full px-4 py-3"
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              disabled={pending || Boolean(success)}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={pending}
            className="btn-subtle rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            退出登录
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending || Boolean(success)}
            className="btn-primary rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "提交中..." : success ? "已完成" : "确认修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
