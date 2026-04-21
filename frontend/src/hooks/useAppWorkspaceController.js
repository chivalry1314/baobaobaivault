import { useEffect, useMemo, useRef } from "react";

export default function useAppWorkspaceController({
  token,
  tenantID,
  uiSettings,
  act,
  setNotice,
  clearAuth,
  authEntry,
  account,
  iam,
  storage,
  audit,
  loadTenant,
}) {
  const refreshingRef = useRef(false);

  async function refreshAll() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await act(async () => {
        await Promise.all([
          loadTenant(),
          iam.loadUsers(),
          iam.loadPermissions(),
          iam.loadRoles(),
          iam.loadNamespaces(),
          storage.loadStorageConfigs(),
          account.loadAksk(),
          audit.loadAuditLogs(),
        ]);
        await storage.loadObjects();
      });
    } finally {
      refreshingRef.current = false;
    }
  }

  useEffect(() => {
    if (!token) return;
    void refreshAll();
  }, [token, tenantID]);

  useEffect(() => {
    if (!storage.selectedNamespaceID && iam.namespaces.length > 0) {
      storage.setSelectedNamespaceID(iam.namespaces[0].id);
    }
  }, [iam.namespaces, storage.selectedNamespaceID]);

  useEffect(() => {
    if (!token || !uiSettings?.enableAutoRefresh) return;

    const minutes = Number(uiSettings.refreshMinutes) > 0 ? Number(uiSettings.refreshMinutes) : 5;
    const timer = setInterval(() => {
      void refreshAll();
    }, Math.trunc(minutes * 60 * 1000));

    return () => clearInterval(timer);
  }, [token, uiSettings?.enableAutoRefresh, uiSettings?.refreshMinutes]);

  const selectedNamespace = useMemo(
    () => iam.namespaces.find((x) => x.id === storage.selectedNamespaceID) || null,
    [iam.namespaces, storage.selectedNamespaceID]
  );

  function logout() {
    clearAuth();
    authEntry.resetAuthEntry();
    account.resetAccount();
    iam.resetIam();
    storage.resetStorage();
    audit.resetAudit();
    setNotice({ type: "success", text: "已退出登录" });
  }

  return {
    refreshAll,
    selectedNamespace,
    logout,
  };
}
