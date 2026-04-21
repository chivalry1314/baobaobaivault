import { useEffect, useState } from "react";
import { TENANT_KEY, TOKEN_KEY, USER_KEY } from "../constants/forms";
import { parseJson } from "../utils/data";

export default function useAuthSession() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY) || "";
    if (!savedToken) return;
    setToken(savedToken);
    setUser(parseJson(localStorage.getItem(USER_KEY) || "null", null));
    setTenant(parseJson(localStorage.getItem(TENANT_KEY) || "null", null));
  }, []);

  function saveAuth(data) {
    setToken(data.token);
    setUser(data.user || null);
    setTenant(data.tenant || null);
    localStorage.setItem(TOKEN_KEY, data.token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user || null));
    localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant || null));
  }

  function saveTenant(record) {
    setTenant(record);
    localStorage.setItem(TENANT_KEY, JSON.stringify(record));
  }

  function clearAuth() {
    setToken("");
    setUser(null);
    setTenant(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
  }

  return {
    token,
    setToken,
    user,
    setUser,
    tenant,
    saveTenant,
    saveAuth,
    clearAuth,
  };
}

