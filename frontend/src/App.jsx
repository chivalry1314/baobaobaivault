import { lazy, Suspense, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiBase } from "./api";
import { allowPublicRegister } from "./constants/auth";
import { navItems as allNavItems } from "./constants/navigation";
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
import useAuthEntryController from "./hooks/useAuthEntryController";
import useAppWorkspaceController from "./hooks/useAppWorkspaceController";

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const OverviewAccountPage = lazy(() => import("./pages/OverviewAccountPage"));
const IamPage = lazy(() => import("./pages/IamPage"));
const StoragePage = lazy(() => import("./pages/StoragePage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));

function App() {
  const location = useLocation();
  const { token, user, saveAuth, clearAuth } = useAuthSession();
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [uiSettings, setUiSettings] = useState(readUiSettings);
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
    const firstChildRoute = visibleNavItems
      .flatMap((item) => (Array.isArray(item?.children) ? item.children : []))
      .find((child) => child?.to)?.to;
    return firstChildRoute || "/app/not-found";
  }, [visibleNavItems]);

  function onSettingsSaved(nextSettings) {
    setUiSettings(nextSettings || readUiSettings());
  }

  const authEntry = useAuthEntryController({ act, saveAuth });
  const account = useAccountController({ token, act });
  const storage = useStorageController({
    token,
    act,
    setNotice,
    onStorageChanged: async () => {
      await account.loadAksk();
      await audit.loadAuditLogs();
    },
  });
  const iam = useIamController({
    token,
    act,
    storageConfigs: storage.storageConfigs,
    loadObjects: storage.loadObjects,
  });
  const audit = useAuditController({ token, act });

  const workspace = useAppWorkspaceController({
    token,
    uiSettings,
    act,
    setNotice,
    clearAuth,
    authEntry,
    account,
    iam,
    storage,
    audit,
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
    <Suspense fallback={null}>
      <DashboardLayout
        token={token}
        user={user}
        navItems={visibleNavItems}
        isPlatformAdmin={isPlatformAdminUser}
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
            onLogin={authEntry.onLogin}
          />
        ) : (
          <>
            {appPage === "overview" ? <OverviewPage user={user} refreshAll={workspace.refreshAll} logout={workspace.logout} busy={busy} /> : null}

            {appPage === "profile" ? <ProfilePage user={user} /> : null}

            {appPage === "account" ? (
              <OverviewAccountPage
                user={user}
                busy={busy}
                refreshAll={workspace.refreshAll}
                logout={workspace.logout}
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

            {["iam-users", "iam-roles", "iam-namespaces"].includes(appPage) ? (
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

            {["storage-config", "storage-objects"].includes(appPage) ? (
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

            {appPage === "settings" ? <SettingsPage apiBase={apiBase} busy={busy} onSaved={onSettingsSaved} onRefreshNow={() => void workspace.refreshAll()} /> : null}

            {appPage === "forbidden" ? <ForbiddenPage fallbackRoute={defaultAppRoute} /> : null}

            {appPage === "not-found" ? <NotFoundPage /> : null}
          </>
        )}
      </DashboardLayout>
    </Suspense>
  );
}

export default App;
