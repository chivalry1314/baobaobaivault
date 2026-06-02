import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { getSafeRedirectPath } from "@/components/share/auth/helpers";
import { useShareSession } from "@/components/share/session-provider";
import type { AuthMode } from "@/components/share/auth/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";

export function useAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = useShareSession();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const redirectPath = getSafeRedirectPath(searchParams.get("next"), "/creator");

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace(redirectPath);
    router.refresh();
  }, [redirectPath, router, user]);

  function switchMode(nextMode: AuthMode) {
    if (pending) {
      return;
    }
    setMode(nextMode);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedNickname = nickname.trim();

    if (!trimmedEmail) {
      setError("请输入邮箱。");
      return;
    }

    if (mode === "register" && !trimmedNickname) {
      setError("请输入昵称。");
      return;
    }

    if (!trimmedPassword) {
      setError("请输入密码。");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response =
        mode === "register"
          ? await shareApi.register({
              email: trimmedEmail,
              nickname: trimmedNickname,
              password: trimmedPassword,
            })
          : await shareApi.login({
              email: trimmedEmail,
              password: trimmedPassword,
            });

      setUser(response.user);
      router.push(redirectPath);
      router.refresh();
    } catch (submitError) {
      const fallback =
        mode === "register"
          ? "暂时无法注册，请稍后重试"
          : "暂时无法登录，请稍后重试";
      setError(getShareErrorMessage(submitError, fallback));
    } finally {
      setPending(false);
    }
  }

  return {
    sessionChecking: false,
    mode,
    email,
    nickname,
    password,
    showPassword,
    pending,
    error,
    switchMode,
    setEmail,
    setNickname,
    setPassword,
    setShowPassword,
    handleSubmit,
  };
}
