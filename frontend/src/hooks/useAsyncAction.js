import { useCallback, useState } from "react";

export default function useAsyncAction(setNotice) {
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (fn, success = "") => {
      setBusy(true);
      try {
        const result = await fn();
        if (success) setNotice({ type: "success", text: success });
        return result;
      } catch (error) {
        setNotice({ type: "error", text: error.message || "请求失败" });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [setNotice]
  );

  return { busy, act };
}
