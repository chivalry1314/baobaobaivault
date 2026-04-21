import { useEffect, useState } from "react";
import { api } from "../api";
import { emptyNamespaceForm, emptyRoleForm, emptyUserForm } from "../constants/forms";
import { parseOptionalPositiveInt } from "../utils/data";

function buildTenantParams(isPlatformAdmin, tenantID) {
  if (!isPlatformAdmin || !tenantID) return undefined;
  return { tenant_id: tenantID };
}

export default function useIamController({ token, tenantID, isPlatformAdmin, act, storageConfigs, loadObjects }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [editingRoleID, setEditingRoleID] = useState("");
  const [namespaceForm, setNamespaceForm] = useState(emptyNamespaceForm);

  useEffect(() => {
    setUsers([]);
    setRoles([]);
    setNamespaces([]);
    setUserForm(emptyUserForm);
    setRoleForm(emptyRoleForm);
    setEditingRoleID("");
    setNamespaceForm(emptyNamespaceForm);
  }, [tenantID]);

  async function loadUsers() {
    const page = await api.listUsers(token, { page: 1, page_size: 100, ...buildTenantParams(isPlatformAdmin, tenantID) });
    setUsers(page?.items || []);
  }

  async function loadPermissions() {
    const list = await api.listPermissions(token);
    setPermissions(Array.isArray(list) ? list : []);
  }

  async function loadRoles() {
    const list = await api.listRoles(token, buildTenantParams(isPlatformAdmin, tenantID));
    setRoles(Array.isArray(list) ? list : []);
  }

  async function loadNamespaces() {
    const page = await api.listNamespaces(token, { page: 1, page_size: 100, ...buildTenantParams(isPlatformAdmin, tenantID) });
    setNamespaces(page?.items || []);
  }

  function toggleID(current, id) {
    const source = Array.isArray(current) ? current : [];
    if (source.includes(id)) return source.filter((x) => x !== id);
    return [...source, id];
  }

  async function onCreateUser(event) {
    event.preventDefault();
    const roleIDs = Array.isArray(userForm.roleIDs) ? userForm.roleIDs : [];
    const ok = await act(
      () =>
        api.createUser(
          token,
          {
            username: userForm.username,
            email: userForm.email,
            password: userForm.password,
            nickname: userForm.nickname,
            role_ids: roleIDs,
          },
          buildTenantParams(isPlatformAdmin, tenantID)
        ),
      "用户已创建"
    );
    if (ok) {
      setUserForm(emptyUserForm);
      await loadUsers();
    }
  }

  async function onSubmitRole(event) {
    event.preventDefault();
    const payload = {
      code: roleForm.code,
      name: roleForm.name,
      description: roleForm.description,
      level: Number(roleForm.level) || 0,
      permission_ids: roleForm.permissionIDs,
      namespace_ids: roleForm.namespaceIDs,
    };

    const ok = await act(() => {
      if (editingRoleID) {
        return api.updateRole(
          token,
          editingRoleID,
          {
            name: payload.name,
            description: payload.description,
            level: payload.level,
            permission_ids: payload.permission_ids,
            namespace_ids: payload.namespace_ids,
          },
          buildTenantParams(isPlatformAdmin, tenantID)
        );
      }
      return api.createRole(token, payload, buildTenantParams(isPlatformAdmin, tenantID));
    }, editingRoleID ? "角色已更新" : "角色已创建");

    if (ok) {
      setRoleForm(emptyRoleForm);
      setEditingRoleID("");
      await loadRoles();
      await loadUsers();
    }
  }

  async function onDeleteRole(id) {
    if (!window.confirm("确认删除该角色吗？")) return;
    const ok = await act(() => api.deleteRole(token, id, buildTenantParams(isPlatformAdmin, tenantID)), "角色已删除");
    if (ok) {
      await loadRoles();
      await loadUsers();
    }
  }

  function onEditRole(role) {
    setEditingRoleID(role.id);
    setRoleForm({
      code: role.code || "",
      name: role.name || "",
      description: role.description || "",
      level: role.level ?? 0,
      permissionIDs: (role.permissions || []).map((permission) => permission.id),
      namespaceIDs: (role.namespaces || []).map((namespace) => namespace.id),
    });
  }

  function onCancelRoleEdit() {
    setEditingRoleID("");
    setRoleForm(emptyRoleForm);
  }

  async function onDeleteUser(id) {
    if (!window.confirm("确认删除该用户吗？")) return;
    const ok = await act(() => api.deleteUser(token, id), "用户已删除");
    if (ok) await loadUsers();
  }

  async function onCreateNamespace(event) {
    event.preventDefault();
    const maxStorage = parseOptionalPositiveInt(namespaceForm.maxStorage);
    const maxFiles = parseOptionalPositiveInt(namespaceForm.maxFiles);
    const maxFileSize = parseOptionalPositiveInt(namespaceForm.maxFileSize);
    const ok = await act(
      () =>
        api.createNamespace(
          token,
          {
            name: namespaceForm.name,
            description: namespaceForm.description,
            storage_config_id: namespaceForm.storageConfigID,
            path_prefix: namespaceForm.pathPrefix,
            max_storage: maxStorage,
            max_files: maxFiles,
            max_file_size: maxFileSize,
          },
          buildTenantParams(isPlatformAdmin, tenantID)
        ),
      "命名空间已创建"
    );
    if (ok) {
      setNamespaceForm(emptyNamespaceForm);
      await loadNamespaces();
    }
  }

  async function onDeleteNamespace(id) {
    if (!window.confirm("确认删除该命名空间吗？")) return;
    const ok = await act(() => api.deleteNamespace(token, id), "命名空间已删除");
    if (ok) {
      await loadNamespaces();
      await loadObjects();
    }
  }

  function resetIam() {
    setUsers([]);
    setRoles([]);
    setPermissions([]);
    setNamespaces([]);
    setUserForm(emptyUserForm);
    setRoleForm(emptyRoleForm);
    setEditingRoleID("");
    setNamespaceForm(emptyNamespaceForm);
  }

  return {
    users,
    roles,
    permissions,
    namespaces,
    userForm,
    setUserForm,
    roleForm,
    setRoleForm,
    editingRoleID,
    namespaceForm,
    setNamespaceForm,
    storageConfigs,
    loadUsers,
    loadPermissions,
    loadRoles,
    loadNamespaces,
    toggleID,
    onCreateUser,
    onSubmitRole,
    onDeleteRole,
    onEditRole,
    onCancelRoleEdit,
    onDeleteUser,
    onCreateNamespace,
    onDeleteNamespace,
    resetIam,
  };
}
