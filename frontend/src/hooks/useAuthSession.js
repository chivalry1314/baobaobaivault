import { useEffect, useState } from "react";
import { TOKEN_KEY, USER_KEY } from "../constants/forms";
import { parseJson } from "../utils/data";

export default function useAuthSession() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY) || "";
    if (!savedToken) return;
    setToken(savedToken);
    setUser(parseJson(localStorage.getItem(USER_KEY) || "null", null));
  }, []);

  function saveAuth(data) {
    setToken(data.token);
    setUser(data.user || null);
    localStorage.setItem(TOKEN_KEY, data.token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user || null));
  }

  function clearAuth() {
    setToken("");
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return {
    token,
    setToken,
    user,
    setUser,
    saveAuth,
    clearAuth,
  };
}
