import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { getSafeRedirectPath } from "@/components/share/auth/helpers";
import { useShareSession } from "@/components/share/session-provider";
import type { AuthMode, RegisterStep } from "@/components/share/auth/types";
import { ShareApiError, getShareErrorMessage, shareApi } from "@/lib/share-api";

const authMessages = {
  emailRequired: "\u8bf7\u8f93\u5165\u90ae\u7bb1",
  nicknameRequired: "\u8bf7\u8f93\u5165\u6635\u79f0",
  passwordRequired: "\u8bf7\u8f93\u5165\u5bc6\u7801",
  verificationCodeRequired: "\u8bf7\u8f93\u5165\u9a8c\u8bc1\u7801",
  resendFallback: "\u6682\u65f6\u65e0\u6cd5\u91cd\u65b0\u53d1\u9001\u9a8c\u8bc1\u7801\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5",
  registerFallback: "\u6682\u65f6\u65e0\u6cd5\u6ce8\u518c\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5",
  verifyFallback: "\u6682\u65f6\u65e0\u6cd5\u5b8c\u6210\u90ae\u7bb1\u9a8c\u8bc1\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5",
  loginFallback: "\u6682\u65f6\u65e0\u6cd5\u767b\u5f55\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5",
} as const;

export function useAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, sessionChecking, setUser } = useShareSession();

  const [mode, setMode] = useState<AuthMode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [resendIntervalSeconds, setResendIntervalSeconds] = useState(60);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationExpiresIn, setVerificationExpiresIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [error, setError] = useState("");

  const redirectPath = getSafeRedirectPath(searchParams.get("next"), "/creator");

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace(redirectPath);
    router.refresh();
  }, [redirectPath, router, user]);

  useEffect(() => {
    let active = true;
    void shareApi.authConfig()
      .then((response) => {
        if (!active) {
          return;
        }
        setEmailVerificationEnabled(response.config.emailVerificationEnabled);
        setResendIntervalSeconds(response.config.resendIntervalSeconds);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setEmailVerificationEnabled(false);
        setResendIntervalSeconds(60);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldownSeconds]);

  function resetRegisterFlow() {
    setRegisterStep("form");
    setVerificationCode("");
    setVerificationEmail("");
    setVerificationExpiresIn(0);
  }

  function switchMode(nextMode: AuthMode) {
    if (pending) {
      return;
    }
    setMode(nextMode);
    resetRegisterFlow();
    setError("");
  }

  function backToRegister() {
    if (pending) {
      return;
    }
    setRegisterStep("form");
    setVerificationCode("");
    setError("");
  }

  async function resendVerificationCode() {
    const resendEmail = (verificationEmail || email).trim();
    if (!resendEmail || resendPending || pending || resendCooldownSeconds > 0) {
      return;
    }

    setResendPending(true);
    setError("");

    try {
      const response = await shareApi.resendRegisterCode({ email: resendEmail });
      setVerificationEmail(response.email || resendEmail);
      setVerificationExpiresIn(response.expiresIn ?? 0);
      setResendCooldownSeconds(resendIntervalSeconds);
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, authMessages.resendFallback));
    } finally {
      setResendPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedNickname = nickname.trim();
    const trimmedVerificationCode = verificationCode.trim();

    if (!trimmedEmail) {
      setError(authMessages.emailRequired);
      return;
    }

    if (mode === "register" && registerStep === "form" && !trimmedNickname) {
      setError(authMessages.nicknameRequired);
      return;
    }

    if (mode === "register" && registerStep === "verify") {
      if (!trimmedVerificationCode) {
        setError(authMessages.verificationCodeRequired);
        return;
      }
    } else if (!trimmedPassword) {
      setError(authMessages.passwordRequired);
      return;
    }

    setPending(true);
    setError("");

    try {
      if (mode === "register") {
        if (registerStep === "verify") {
          const verifyResponse = await shareApi.verifyRegisterCode({
            email: verificationEmail || trimmedEmail,
            code: trimmedVerificationCode,
          });

          setUser(verifyResponse.user);
          return;
        }

        const registerResponse = await shareApi.register({
          email: trimmedEmail,
          nickname: trimmedNickname,
          password: trimmedPassword,
        });

        if (registerResponse.user) {
          setUser(registerResponse.user);
          return;
        }

        if (registerResponse.verificationRequired) {
          setRegisterStep("verify");
          setVerificationEmail(registerResponse.email ?? trimmedEmail);
          setVerificationExpiresIn(registerResponse.expiresIn ?? 0);
          setVerificationCode("");
          setResendCooldownSeconds(resendIntervalSeconds);
          return;
        }
      }

      const loginResponse = await shareApi.login({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      setUser(loginResponse.user);
    } catch (submitError) {
      const fallback =
        mode === "register"
          ? registerStep === "verify"
            ? authMessages.verifyFallback
            : authMessages.registerFallback
          : authMessages.loginFallback;
      if (
        mode === "register" &&
        registerStep === "verify" &&
        submitError instanceof ShareApiError &&
        (submitError.status === 403 ||
          submitError.message.toLowerCase().includes("expired") ||
          submitError.message.toLowerCase().includes("too many"))
      ) {
        setRegisterStep("form");
        setVerificationCode("");
        setResendCooldownSeconds(0);
      }
      setError(getShareErrorMessage(submitError, fallback));
    } finally {
      setPending(false);
    }
  }

  return {
    sessionChecking,
    mode,
    registerStep,
    emailVerificationEnabled,
    email,
    nickname,
    password,
    verificationCode,
    verificationEmail,
    verificationExpiresIn,
    showPassword,
    pending,
    resendPending,
    resendCooldownSeconds,
    error,
    switchMode,
    backToRegister,
    resendVerificationCode,
    setEmail,
    setNickname,
    setPassword,
    setVerificationCode,
    setShowPassword,
    handleSubmit,
  };
}
