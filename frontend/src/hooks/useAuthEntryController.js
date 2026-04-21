import { useMemo, useState } from "react";
import { api } from "../api";
import { emptyBootstrap, emptyLogin } from "../constants/forms";

const LOGIN_HINT_KEY = "bv_login_hint";

function readLoginHint() {
  try {
    const raw = localStorage.getItem(LOGIN_HINT_KEY);
    if (!raw) {
      return { remember: true, tenantCode: "", email: "" };
    }
    const parsed = JSON.parse(raw);
    return {
      remember: parsed?.remember !== false,
      tenantCode: typeof parsed?.tenantCode === "string" ? parsed.tenantCode : "",
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
    return { remember: true, tenantCode: "", email: "" };
  }
}

function buildLoginFormFromHint() {
  const hint = readLoginHint();
  if (!hint.remember) return emptyLogin;
  return {
    tenantCode: hint.tenantCode,
    email: hint.email,
    password: "",
  };
}

function persistLoginHint(remember, form, tenantCode) {
  if (!remember) {
    localStorage.removeItem(LOGIN_HINT_KEY);
    return;
  }
  const payload = {
    remember: true,
    tenantCode: String(tenantCode || form?.tenantCode || "").trim(),
    email: String(form?.email || "").trim(),
  };
  localStorage.setItem(LOGIN_HINT_KEY, JSON.stringify(payload));
}

function normalizeTenantOptions(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => ({
      tenantCode: String(item?.tenant_code || "").trim(),
      tenantName: String(item?.tenant_name || "").trim(),
      tenantID: String(item?.tenant_id || "").trim(),
      username: String(item?.username || "").trim(),
      userID: String(item?.user_id || "").trim(),
    }))
    .filter((item) => item.tenantCode);
}

function sortTenantOptions(options, preferredTenantCode) {
  const preferred = String(preferredTenantCode || "").trim();
  const list = Array.isArray(options) ? [...options] : [];
  list.sort((a, b) => {
    const aPreferred = a.tenantCode === preferred ? 1 : 0;
    const bPreferred = b.tenantCode === preferred ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const aName = String(a.tenantName || a.tenantCode || "").toLowerCase();
    const bName = String(b.tenantName || b.tenantCode || "").toLowerCase();
    if (aName < bName) return -1;
    if (aName > bName) return 1;
    return 0;
  });
  return list;
}

export default function useAuthEntryController({ act, saveAuth }) {
  const loginHint = readLoginHint();
  const [bootstrapForm, setBootstrapForm] = useState(emptyBootstrap);
  const [loginForm, setLoginForm] = useState(buildLoginFormFromHint);
  const [rememberIdentity, setRememberIdentity] = useState(loginHint.remember);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [recentTenantCode, setRecentTenantCode] = useState(String(loginHint.tenantCode || "").trim());

  const requiresTenantSelection = useMemo(() => tenantOptions.length > 0, [tenantOptions]);

  async function onBootstrap(event) {
    event.preventDefault();
    const result = await act(
      () =>
        api.bootstrap({
          tenant: {
            name: bootstrapForm.tenantName,
            code: bootstrapForm.tenantCode,
            description: bootstrapForm.tenantDescription,
          },
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

  async function submitEmailLogin(tenantCode = "") {
    const payload = {
      email: String(loginForm.email || "").trim(),
      password: loginForm.password,
    };
    const finalTenantCode = String(tenantCode || "").trim();
    if (finalTenantCode) {
      payload.tenant_code = finalTenantCode;
    }

    const result = await act(() => api.login(payload));
    if (!result) return;

    if (result?.auth) {
      const resolvedTenantCode = String(result?.auth?.tenant?.code || finalTenantCode || "").trim();
      persistLoginHint(rememberIdentity, loginForm, resolvedTenantCode);
      setRecentTenantCode(resolvedTenantCode);
      saveAuth(result.auth);
      setTenantOptions([]);
      setLoginForm(
        rememberIdentity
          ? {
              tenantCode: resolvedTenantCode,
              email: String(loginForm.email || "").trim(),
              password: "",
            }
          : emptyLogin
      );
      return;
    }

    if (result?.requires_tenant_selection) {
      const preferredCode = String(loginForm.tenantCode || recentTenantCode || "").trim();
      const options = sortTenantOptions(normalizeTenantOptions(result.tenant_options), preferredCode);
      const selectedCode = preferredCode && options.some((item) => item.tenantCode === preferredCode) ? preferredCode : options[0]?.tenantCode || "";
      setTenantOptions(options);
      setLoginForm((v) => ({ ...v, tenantCode: selectedCode }));
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    await submitEmailLogin("");
  }

  async function onConfirmTenantSelection(event) {
    event.preventDefault();
    if (!String(loginForm.tenantCode || "").trim()) return;
    await submitEmailLogin(loginForm.tenantCode);
  }

  function onTenantCodeChange(nextTenantCode) {
    setLoginForm((v) => ({ ...v, tenantCode: nextTenantCode }));
  }

  function onBackToTenantDiscovery() {
    setTenantOptions([]);
    setLoginForm((v) => ({ ...v, tenantCode: "" }));
  }

  function onRememberIdentityChange(checked) {
    setRememberIdentity(Boolean(checked));
    if (!checked) {
      localStorage.removeItem(LOGIN_HINT_KEY);
    }
  }

  function resetAuthEntry() {
    setBootstrapForm(emptyBootstrap);
    const hint = readLoginHint();
    setLoginForm(buildLoginFormFromHint());
    setRememberIdentity(hint.remember);
    setRecentTenantCode(String(hint.tenantCode || "").trim());
    setTenantOptions([]);
  }

  return {
    bootstrapForm,
    setBootstrapForm,
    loginForm,
    setLoginForm,
    rememberIdentity,
    onRememberIdentityChange,
    tenantOptions,
    recentTenantCode,
    requiresTenantSelection,
    onTenantCodeChange,
    onConfirmTenantSelection,
    onBackToTenantDiscovery,
    onBootstrap,
    onLogin,
    resetAuthEntry,
  };
}
