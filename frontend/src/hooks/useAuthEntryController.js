import { useState } from "react";
import { api } from "../api";
import { emptyBootstrap, emptyLogin } from "../constants/forms";

const LOGIN_HINT_KEY = "bv_login_hint";

function readLoginHint() {
  try {
    const raw = localStorage.getItem(LOGIN_HINT_KEY);
    if (!raw) {
      return { remember: true, email: "" };
    }
    const parsed = JSON.parse(raw);
    return {
      remember: parsed?.remember !== false,
      email:
        typeof parsed?.email === "string"
          ? parsed.email
          : typeof parsed?.account === "string"
            ? parsed.account
            : typeof parsed?.username === "string"
              ? parsed.username
              : "",
    };
  } catch {
    return { remember: true, email: "" };
  }
}

function buildLoginFormFromHint() {
  const hint = readLoginHint();
  if (!hint.remember) return emptyLogin;
  return {
    email: hint.email,
    password: "",
  };
}

function persistLoginHint(remember, form) {
  if (!remember) {
    localStorage.removeItem(LOGIN_HINT_KEY);
    return;
  }
  const payload = {
    remember: true,
    email: String(form?.email || "").trim(),
  };
  localStorage.setItem(LOGIN_HINT_KEY, JSON.stringify(payload));
}

export default function useAuthEntryController({ act, saveAuth }) {
  const loginHint = readLoginHint();
  const [bootstrapForm, setBootstrapForm] = useState(emptyBootstrap);
  const [loginForm, setLoginForm] = useState(buildLoginFormFromHint);
  const [rememberIdentity, setRememberIdentity] = useState(loginHint.remember);

  async function onBootstrap(event) {
    event.preventDefault();
    const result = await act(
      () =>
        api.bootstrap({
          admin: {
            username: bootstrapForm.adminUsername,
            email: bootstrapForm.adminEmail,
            password: bootstrapForm.adminPassword,
            nickname: bootstrapForm.adminNickname,
          },
        }),
      "初始化完成"
    );
    if (result?.auth) {
      saveAuth(result.auth);
      setBootstrapForm(emptyBootstrap);
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    const payload = {
      email: String(loginForm.email || "").trim(),
      password: loginForm.password,
    };
    const result = await act(() => api.login(payload));
    const auth = result?.auth || result;
    if (!auth?.token) return;

    persistLoginHint(rememberIdentity, loginForm);
    saveAuth(auth);
    setLoginForm(
      rememberIdentity
        ? {
            email: String(loginForm.email || "").trim(),
            password: "",
          }
        : emptyLogin
    );
  }

  function onRememberIdentityChange(checked) {
    const next = Boolean(checked);
    setRememberIdentity(next);
    if (!next) {
      localStorage.removeItem(LOGIN_HINT_KEY);
    }
  }

  function resetAuthEntry() {
    setBootstrapForm(emptyBootstrap);
    const hint = readLoginHint();
    setLoginForm(buildLoginFormFromHint());
    setRememberIdentity(hint.remember);
  }

  return {
    bootstrapForm,
    setBootstrapForm,
    loginForm,
    setLoginForm,
    rememberIdentity,
    onRememberIdentityChange,
    onBootstrap,
    onLogin,
    resetAuthEntry,
  };
}
