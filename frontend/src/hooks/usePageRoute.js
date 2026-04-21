import { useMemo } from "react";

export default function usePageRoute(pathname, allowRegister = true) {
  const authPage = allowRegister && pathname === "/register" ? "register" : "login";
  const appPage = useMemo(() => {
    if (!pathname.startsWith("/app/")) return "overview";
    const key = pathname.replace("/app/", "").split("/")[0];
    return key || "overview";
  }, [pathname]);

  return { authPage, appPage };
}
