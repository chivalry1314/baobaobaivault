import { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, apiBase } from "./api";
import { allowPublicRegister } from "./constants/auth";
import { navItems as allNavItems } from "./constants/navigation";
import DashboardLayout from "./layouts/DashboardLayout";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import ProfilePage from "./pages/ProfilePage";
import OverviewAccountPage from "./pages/OverviewAccountPage";
import IamPage from "./pages/IamPage";
import StoragePage from "./pages/StoragePage";
import AuditPage from "./pages/AuditPage";
import SettingsPage from "./pages/SettingsPage";
import TenantPage from "./pages/TenantPage";
import NotFoundPage from "./pages/NotFoundPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import { formatAuditValue, parseAuditDetail } from "./utils/data";
import { readUiSettings } from "./utils/uiSettings";
import { filterNavItemsByAccess, isPlatformAdmin } from "./utils/access";
import useAuthSession from "./hooks/useAuthSession";
import usePageRoute from "./hooks/usePageRoute";
import useAsyncAction from "./hooks/useAsyncAction";
import useIamController from "./hooks/useIamController";
import useStorageController from "./hooks/useStorageController";
import useAuditController from "./hooks/useAuditController";
import useAccountController from "./hooks/useAccountController";
import useTenantController from "./hooks/useTenantController";
import useAuthEntryController from "./hooks/useAuthEntryController";
import useAppWorkspaceController from "./hooks/useAppWorkspaceController";

function App() {
  const location = useLocation();
  const { token, user, tenant, saveTenant, saveAuth, clearAuth } = useAuthSession();
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [uiSettings, setUiSettings] = useState(readUiSettings);
  const [tenantOptions, setTenantOptions] = useState([]);
  const { busy, act } = useAsyncAction(setNotice);
  const isPlatformAdminUser = useMemo(() => isPlatformAdmin(user), [user]);
  const knownRoutePageKeys = useMemo(() => {
    return allNavItems.flatMap((item) => {
      const children = Array.isArray(item?.children) ? item.children : [];
      if (children.length > 0) {
        return children.map((child) => child.key);
      }
      return [item.key];
    });
  }, []);
  const visibleNavItems = useMemo(() => filterNavItemsByAccess(allNavItems, user), [user]);
  const accessibleRoutePageKeys = useMemo(() => {
    return visibleNavItems.flatMap((item) => {
      const children = Array.isArray(item?.children) ? item.children : [];
      if (children.length > 0) {
        return children.map((child) => child.key);
      }
      return [item.key];
    });
  }, [visibleNavItems]);
  const defaultAppRoute = useMemo(() => {
    const firstDirectRoute = visibleNavItems.find((item) => item?.to)?.to;
    if (firstDirectRoute) return firstDirectRoute;
    const firstChildRoute = visibleNavItems.flatMap((item) => (Array.isArray(item?.children) ? item.children : [])).find((child) => child?.to)?.to;
    return firstChildRoute || "/app/not-found";
  }, [visibleNavItems]);
  const activeTenantID = tenant?.id || "";

  function onSettingsSaved(nextSettings) {
    setUiSettings(nextSettings || readUiSettings());
  }

  async function loadTenant() {
    if (!token) return null;
    const page = await api.listTenants(token);
    const items = Array.isArray(page?.items) ? page.items : [];

    if (isPlatformAdminUser) {
      setTenantOptions(items);
      const current = items.find((item) => item.id === tenant?.id) || items[0] || null;
      if (current || tenant) {
        saveTenant(current);
      }
      return current;
    }

    const current = items[0] || null;
    setTenantOptions(current ? [current] : []);
    if (current || tenant) {
      saveTenant(current);
    }
    return current;
  }

  function onTenantSwitch(nextTenantID) {
    if (!isPlatformAdminUser) return;
    const target = tenantOptions.find((item) => item.id === nextTenantID);
    if (!target || target.id === tenant?.id) return;
    saveTenant(target);
    setNotice({ type: "success", text: `已切换到租户：${target.name || target.code}` });
  }

  const authEntry = useAuthEntryController({ act, saveAuth });
  const account = useAccountController({ token, act });
  const storage = useStorageController({
    token,
    tenantID: activeTenantID,
    isPlatformAdmin: isPlatformAdminUser,
    act,
    setNotice,
    loadTenant,
  });
  const iam = useIamController({
    token,
    tenantID: activeTenantID,
    isPlatformAdmin: isPlatformAdminUser,
    act,
    storageConfigs: storage.storageConfigs,
    loadObjects: storage.loadObjects,
  });
  const audit = useAuditController({ token, tenantID: activeTenantID, isPlatformAdmin: isPlatformAdminUser, act });
  const tenantController = useTenantController({ token, tenant, act, saveTenant, loadTenant });

  const workspace = useAppWorkspaceController({
    token,
    tenantID: activeTenantID,
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
  });

  const { authPage, appPage } = usePageRoute(location.pathname, allowPublicRegister);

  if (!token && !allowPublicRegister && location.pathname === "/register") {
    return <Navigate to="/login" replace />;
  }

  if (!token && !["/login", ...(allowPublicRegister ? ["/register"] : [])].includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  if (token && !location.pathname.startsWith("/app")) {
    return <Navigate to={defaultAppRoute} replace />;
  }

  if (token && (location.pathname === "/app" || location.pathname === "/app/")) {
    return <Navigate to={defaultAppRoute} replace />;
  }

  if (token && ![...knownRoutePageKeys, "not-found", "forbidden"].includes(appPage)) {
    return <Navigate to="/app/not-found" replace />;
  }

  if (token && !["not-found", "forbidden"].includes(appPage) && !accessibleRoutePageKeys.includes(appPage)) {
    return <Navigate to="/app/forbidden" replace />;
  }

  return (
    <DashboardLayout
      token={token}
      user={user}
      tenant={tenant}
      navItems={visibleNavItems}
      isPlatformAdmin={isPlatformAdminUser}
      tenantOptions={tenantOptions}
      activeTenantID={activeTenantID}
      onTenantSwitch={onTenantSwitch}
      notice={notice}
      setNotice={setNotice}
      apiBase={apiBase}
      compactNav={uiSettings.compactNav}
    >
      {!token ? (
        <AuthPage
          authPage={authPage}
          allowPublicRegister={allowPublicRegister}
          busy={busy}
          bootstrapForm={authEntry.bootstrapForm}
          setBootstrapForm={authEntry.setBootstrapForm}
          onBootstrap={authEntry.onBootstrap}
          loginForm={authEntry.loginForm}
          setLoginForm={authEntry.setLoginForm}
          rememberIdentity={authEntry.rememberIdentity}
          onRememberIdentityChange={authEntry.onRememberIdentityChange}
          tenantOptions={authEntry.tenantOptions}
          recentTenantCode={authEntry.recentTenantCode}
          requiresTenantSelection={authEntry.requiresTenantSelection}
          onTenantCodeChange={authEntry.onTenantCodeChange}
          onConfirmTenantSelection={authEntry.onConfirmTenantSelection}
          onBackToTenantDiscovery={authEntry.onBackToTenantDiscovery}
          onLogin={authEntry.onLogin}
        />
      ) : (
        <>
          {appPage === "overview" ? (
            <OverviewPage user={user} tenant={tenant} refreshAll={workspace.refreshAll} logout={workspace.logout} busy={busy} />
          ) : null}

          {appPage === "profile" ? <ProfilePage user={user} tenant={tenant} /> : null}

          {appPage === "account" ? (
            <OverviewAccountPage
              user={user}
              busy={busy}
              refreshAll={workspace.refreshAll}
              logout={workspace.logout}
              tenant={tenant}
              onChangePassword={account.onChangePassword}
              passwordForm={account.passwordForm}
              setPasswordForm={account.setPasswordForm}
              onCreateAksk={account.onCreateAksk}
              akskForm={account.akskForm}
              setAkskForm={account.setAkskForm}
              lastSecret={account.lastSecret}
              akskList={account.akskList}
              onRevokeAksk={account.onRevokeAksk}
            />
          ) : null}

          {(["iam-users", "iam-roles", "iam-namespaces"].includes(appPage)) ? (
            <IamPage
              activeTab={appPage}
              users={iam.users}
              userForm={iam.userForm}
              setUserForm={iam.setUserForm}
              editingUserID={iam.editingUserID}
              roles={iam.roles}
              permissions={iam.permissions}
              namespaces={iam.namespaces}
              storageConfigs={storage.storageConfigs}
              roleForm={iam.roleForm}
              setRoleForm={iam.setRoleForm}
              editingRoleID={iam.editingRoleID}
              namespaceForm={iam.namespaceForm}
              setNamespaceForm={iam.setNamespaceForm}
              editingNamespaceID={iam.editingNamespaceID}
              busy={busy}
              toggleID={iam.toggleID}
              onCreateUser={iam.onCreateUser}
              onEditUser={iam.onEditUser}
              onUpdateUser={iam.onUpdateUser}
              onCancelUserEdit={iam.onCancelUserEdit}
              onDeleteUser={iam.onDeleteUser}
              onSubmitRole={iam.onSubmitRole}
              onCancelRoleEdit={iam.onCancelRoleEdit}
              onDeleteRole={iam.onDeleteRole}
              onEditRole={iam.onEditRole}
              onCreateNamespace={iam.onCreateNamespace}
              onEditNamespace={iam.onEditNamespace}
              onUpdateNamespace={iam.onUpdateNamespace}
              onCancelNamespaceEdit={iam.onCancelNamespaceEdit}
              onDeleteNamespace={iam.onDeleteNamespace}
            />
          ) : null}

          {(["storage-config", "storage-objects"].includes(appPage)) ? (
            <StoragePage
              activeTab={appPage}
              storageConfigs={storage.storageConfigs}
              storageForm={storage.storageForm}
              setStorageForm={storage.setStorageForm}
              onCreateStorageConfig={storage.onCreateStorageConfig}
              onDeleteStorageConfig={storage.onDeleteStorageConfig}
              selectedNamespace={workspace.selectedNamespace}
              selectedNamespaceID={storage.selectedNamespaceID}
              setSelectedNamespaceID={storage.setSelectedNamespaceID}
              setSelectedObjectKey={storage.setSelectedObjectKey}
              setObjectVersions={storage.setObjectVersions}
              setPresignPutInfo={storage.setPresignPutInfo}
              namespaces={iam.namespaces}
              objectPrefix={storage.objectPrefix}
              setObjectPrefix={storage.setObjectPrefix}
              loadObjects={storage.loadObjects}
              busy={busy}
              onUploadObject={storage.onUploadObject}
              objectForm={storage.objectForm}
              setObjectForm={storage.setObjectForm}
              setUploadFile={storage.setUploadFile}
              onPresignPut={storage.onPresignPut}
              onCompletePresignPut={storage.onCompletePresignPut}
              presignPutInfo={storage.presignPutInfo}
              presignUrl={storage.presignUrl}
              objects={storage.objects}
              onDownloadObject={storage.onDownloadObject}
              onViewVersions={storage.onViewVersions}
              onPresign={storage.onPresign}
              onDeleteObject={storage.onDeleteObject}
              selectedObjectKey={storage.selectedObjectKey}
              objectVersions={storage.objectVersions}
              onRollbackVersion={storage.onRollbackVersion}
            />
          ) : null}

          {appPage === "audit" ? (
            <AuditPage
              auditLogs={audit.auditLogs}
              onApplyAuditFilter={audit.onApplyAuditFilter}
              auditFilter={audit.auditFilter}
              setAuditFilter={audit.setAuditFilter}
              busy={busy}
              onResetAuditFilter={audit.onResetAuditFilter}
              parseAuditDetail={parseAuditDetail}
              formatAuditValue={formatAuditValue}
            />
          ) : null}

          {appPage === "tenant" ? (
            <TenantPage
              tenant={tenant}
              busy={busy}
              refreshAll={workspace.refreshAll}
              tenantForm={tenantController.tenantForm}
              formErrors={tenantController.formErrors}
              hint={tenantController.hint}
              pendingChanges={tenantController.pendingChanges}
              hasPendingConfirm={tenantController.hasPendingConfirm}
              onTenantFieldChange={tenantController.onTenantFieldChange}
              onUpdateTenant={tenantController.onUpdateTenant}
              cancelPendingUpdate={tenantController.cancelPendingUpdate}
              confirmPendingUpdate={tenantController.confirmPendingUpdate}
            />
          ) : null}

          {appPage === "settings" ? (
            <SettingsPage
              apiBase={apiBase}
              busy={busy}
              onSaved={onSettingsSaved}
              onRefreshNow={() => void workspace.refreshAll()}
            />
          ) : null}

          {appPage === "forbidden" ? <ForbiddenPage fallbackRoute={defaultAppRoute} /> : null}

          {appPage === "not-found" ? <NotFoundPage /> : null}
        </>
      )}
    </DashboardLayout>
  );
}

export default App;
