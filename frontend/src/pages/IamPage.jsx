import { useMemo, useState } from "react";
import { Layers, Plus, Save, Search, ShieldCheck, ShieldPlus, UserPlus, Users } from "lucide-react";
import Panel from "../components/Panel";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

const permissionResourceMeta = {
  user: { label: "\u7528\u6237\u7ba1\u7406", order: 1 },
  namespace: { label: "\u547d\u540d\u7a7a\u95f4", order: 2 },
  storage: { label: "\u5b58\u50a8\u914d\u7f6e", order: 3 },
  object: { label: "\u5bf9\u8c61\u5b58\u50a8", order: 4 },
  audit: { label: "\u5ba1\u8ba1\u65e5\u5fd7", order: 5 },
};

const permissionActionOrder = {
  list: 1,
  read: 2,
  create: 3,
  update: 4,
  delete: 5,
  share: 6,
  admin: 7,
};

function normalizePermissionResource(permission) {
  const fromField = String(permission?.resource || "").trim().toLowerCase();
  if (fromField) return fromField;
  const fromCode = String(permission?.code || "").split(":")[0];
  return String(fromCode || "other").trim().toLowerCase() || "other";
}

function normalizePermissionAction(permission) {
  const fromField = String(permission?.action || "").trim().toLowerCase();
  if (fromField) return fromField;
  const fromCode = String(permission?.code || "").split(":")[1];
  return String(fromCode || "").trim().toLowerCase();
}

export default function IamPage({
  activeTab,
  users,
  userForm,
  setUserForm,
  editingUserID,
  roles,
  permissions,
  namespaces,
  storageConfigs,
  roleForm,
  setRoleForm,
  editingRoleID,
  namespaceForm,
  setNamespaceForm,
  editingNamespaceID,
  busy,
  toggleID,
  onCreateUser,
  onEditUser,
  onUpdateUser,
  onCancelUserEdit,
  onDeleteUser,
  onSubmitRole,
  onCancelRoleEdit,
  onDeleteRole,
  onEditRole,
  onCreateNamespace,
  onEditNamespace,
  onUpdateNamespace,
  onCancelNamespaceEdit,
  onDeleteNamespace,
}) {
  const showUsers = activeTab === "iam-users";
  const showRoles = activeTab === "iam-roles";
  const showNamespaces = activeTab === "iam-namespaces";

  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNsModal, setShowNsModal] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [roleSearch, setRoleSearch] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [nsSearch, setNsSearch] = useState("");
  const [nsPage, setNsPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.email, u.nickname, ...(u.roles || []).map((r) => r.code)].some((s) => String(s || "").toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter((r) => [r.name, r.code, r.description, ...(r.permissions || []).map((p) => p.code)].some((s) => String(s || "").toLowerCase().includes(q)));
  }, [roles, roleSearch]);

  const filteredNamespaces = useMemo(() => {
    const q = nsSearch.toLowerCase().trim();
    if (!q) return namespaces;
    return namespaces.filter((n) => [n.name, n.id, n.pathPrefix, n.description].some((s) => String(s || "").toLowerCase().includes(q)));
  }, [namespaces, nsSearch]);

  const permissionGroups = useMemo(() => {
    const grouped = new Map();
    const source = Array.isArray(permissions) ? permissions : [];

    source.forEach((permission) => {
      const resourceKey = normalizePermissionResource(permission);
      const actionKey = normalizePermissionAction(permission);
      const meta = permissionResourceMeta[resourceKey] || { label: resourceKey || "other", order: 99 };

      if (!grouped.has(resourceKey)) {
        grouped.set(resourceKey, {
          key: resourceKey,
          label: meta.label,
          order: meta.order,
          items: [],
        });
      }

      grouped.get(resourceKey).items.push({
        ...permission,
        actionOrder: permissionActionOrder[actionKey] || 99,
      });
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => {
          if (a.actionOrder !== b.actionOrder) return a.actionOrder - b.actionOrder;
          return String(a.code || "").localeCompare(String(b.code || ""));
        }),
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });
  }, [permissions]);

  const pagedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  const pagedRoles = filteredRoles.slice((rolePage - 1) * PAGE_SIZE, rolePage * PAGE_SIZE);
  const pagedNamespaces = filteredNamespaces.slice((nsPage - 1) * PAGE_SIZE, nsPage * PAGE_SIZE);

  function confirmDelete(type, id, label) {
    setDeleteTarget({ type, id, label });
  }

  function executeDelete() {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === "user") onDeleteUser(id);
    else if (type === "role") onDeleteRole(id);
    else if (type === "namespace") onDeleteNamespace(id);
    setDeleteTarget(null);
  }

  function closeRoleModal() {
    onCancelRoleEdit();
    setShowRoleModal(false);
  }

  function closeUserModal() {
    onCancelUserEdit();
    setShowUserModal(false);
  }

  function closeNsModal() {
    onCancelNamespaceEdit();
    setShowNsModal(false);
  }

  function addPermissionGroup(ids) {
    setRoleForm((v) => {
      const next = new Set(Array.isArray(v.permissionIDs) ? v.permissionIDs : []);
      ids.forEach((id) => next.add(id));
      return { ...v, permissionIDs: Array.from(next) };
    });
  }

  function removePermissionGroup(ids) {
    setRoleForm((v) => {
      const next = new Set(Array.isArray(v.permissionIDs) ? v.permissionIDs : []);
      ids.forEach((id) => next.delete(id));
      return { ...v, permissionIDs: Array.from(next) };
    });
  }

  return (
    <section id="section-iam" className="grid one">
      {showUsers ? (
        <Panel title="用户管理" subtitle={`${users.length} 位用户`}>
          <div className="section-header">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="搜索用户名、邮箱、昵称或角色" value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => { if (editingUserID) onCancelUserEdit(); setShowUserModal(true); }}>
              <UserPlus size={16} />
              新增用户
            </button>
          </div>

          {pagedUsers.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedUsers.map((item) => {
                  const roleCodes = (item.roles || []).map((r) => r.code);
                  const isAdmin = roleCodes.includes("admin");
                  return (
                    <div className="mini-row" key={item.id}>
                      <div>
                        <strong>
                          {item.username || "未命名用户"}
                          {isAdmin ? <span className="badge info">管理员</span> : null}
                        </strong>
                        <small>{item.email}</small>
                        <small>{roleCodes.join(", ") || "未分配角色"}</small>
                      </div>
                      <div className="actions-inline">
                        <button className="btn small ghost" type="button" onClick={() => { onEditUser(item); setShowUserModal(true); }}>
                          编辑
                        </button>
                        <button
                          className="btn small danger"
                          type="button"
                          onClick={() => confirmDelete("user", item.id, item.username || item.email)}
                          disabled={isAdmin}
                          title={isAdmin ? "管理员账号不允许删除" : ""}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination total={filteredUsers.length} page={userPage} onChange={setUserPage} />
            </>
          ) : (
            <div className="empty-state">
              <Users size={40} />
              <p>{userSearch ? "未找到匹配的用户" : "暂无用户数据"}</p>
            </div>
          )}
        </Panel>
      ) : null}

      {showRoles ? (
        <Panel title="角色权限" subtitle={`${roles.length} 个角色`} delay={80}>
          <div className="section-header">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="搜索角色、描述或权限码" value={roleSearch} onChange={(event) => { setRoleSearch(event.target.value); setRolePage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => { if (editingRoleID) onCancelRoleEdit(); setShowRoleModal(true); }}>
              <ShieldPlus size={16} />
              新增角色
            </button>
          </div>

          {pagedRoles.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedRoles.map((role) => (
                  <div className="mini-row" key={role.id}>
                    <div>
                      <strong>
                        {role.name} ({role.code})
                      </strong>
                      <small>等级: {role.level} {role.is_system ? "系统角色" : "业务角色"}</small>
                      <small>{(role.permissions || []).map((p) => p.code).join(", ") || "无权限"}</small>
                      <small>命名空间: {(role.namespaces || []).length > 0 ? (role.namespaces || []).map((ns) => ns.name).join(", ") : "全局"}</small>
                    </div>
                    <div className="actions-inline">
                      <button className="btn small ghost" type="button" onClick={() => { onEditRole(role); setShowRoleModal(true); }} disabled={role.is_system || role.code === "admin"}>
                        编辑
                      </button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("role", role.id, `${role.name} (${role.code})`)} disabled={role.is_system || role.code === "admin"}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredRoles.length} page={rolePage} onChange={setRolePage} />
            </>
          ) : (
            <div className="empty-state">
              <ShieldCheck size={40} />
              <p>{roleSearch ? "未找到匹配的角色" : "暂无角色数据"}</p>
            </div>
          )}
        </Panel>
      ) : null}

      {showNamespaces ? (
        <Panel title="命名空间" subtitle={`${namespaces.length} 个命名空间`} delay={120}>
          <div className="section-header">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="搜索命名空间名称或 ID" value={nsSearch} onChange={(event) => { setNsSearch(event.target.value); setNsPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowNsModal(true)}>
              <Plus size={16} />
              新增命名空间
            </button>
          </div>

          {pagedNamespaces.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedNamespaces.map((namespace) => (
                  <div className="mini-row" key={namespace.id}>
                    <div>
                      <strong>{namespace.name}</strong>
                      <small>{namespace.id}</small>
                      <small>
                        文件: {namespace.used_files || 0}
                        {namespace.max_files ? ` / ${namespace.max_files}` : ""}
                        {" | "}
                        存储: {namespace.used_storage || 0}
                        {namespace.max_storage ? ` / ${namespace.max_storage}` : ""}
                      </small>
                    </div>
                    <div className="actions-inline">
                      <button className="btn small ghost" type="button" onClick={() => { onEditNamespace(namespace); setShowNsModal(true); }}>
                        编辑
                      </button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("namespace", namespace.id, namespace.name)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredNamespaces.length} page={nsPage} onChange={setNsPage} />
            </>
          ) : (
            <div className="empty-state">
              <Layers size={40} />
              <p>{nsSearch ? "未找到匹配的命名空间" : "暂无命名空间数据"}</p>
            </div>
          )}
        </Panel>
      ) : null}

      <Modal
        open={showUserModal}
        title={editingUserID ? "编辑用户" : "新增用户"}
        subtitle={editingUserID ? "更新用户资料与角色信息" : "创建一个新的平台用户"}
        onClose={closeUserModal}
      >
        <form className="form-grid compact" onSubmit={(event) => { editingUserID ? onUpdateUser(event) : onCreateUser(event); closeUserModal(); }}>
          <div className="grid two mini-gap">
            <input placeholder="用户名（可选）" value={userForm.username} onChange={(event) => setUserForm((v) => ({ ...v, username: event.target.value }))} disabled={Boolean(editingUserID)} />
            <input type="email" placeholder="邮箱" value={userForm.email} onChange={(event) => setUserForm((v) => ({ ...v, email: event.target.value }))} required />
          </div>
          <div className="grid two mini-gap">
            <input
              type="password"
              placeholder={editingUserID ? "新密码（不填则不修改）" : "登录密码"}
              value={userForm.password}
              onChange={(event) => setUserForm((v) => ({ ...v, password: event.target.value }))}
              required={!editingUserID}
            />
            <input placeholder="昵称" value={userForm.nickname} onChange={(event) => setUserForm((v) => ({ ...v, nickname: event.target.value }))} />
          </div>
          <div className="section-label">角色分配</div>
          <div className="permission-grid">
            {roles.map((role) => (
              <label className="check" key={role.id}>
                <input type="checkbox" checked={Array.isArray(userForm.roleIDs) && userForm.roleIDs.includes(role.id)} onChange={() => setUserForm((v) => ({ ...v, roleIDs: toggleID(v.roleIDs, role.id) }))} />
                <span>{role.name}</span>
              </label>
            ))}
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {editingUserID ? <Save size={18} /> : <UserPlus size={18} />}
              <span>{editingUserID ? "保存用户" : "创建用户"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeUserModal} disabled={busy}>
              取消
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showRoleModal}
        title={editingRoleID ? "编辑角色" : "新增角色"}
        subtitle={editingRoleID ? "更新角色基础信息与权限范围" : "创建新的角色模板"}
        onClose={closeRoleModal}
      >
        <form className="form-grid compact role-modal-form" onSubmit={(event) => { onSubmitRole(event); closeRoleModal(); }}>
          <div className="grid two mini-gap">
            <input placeholder="角色编码 (Code)" value={roleForm.code} onChange={(event) => setRoleForm((v) => ({ ...v, code: event.target.value }))} required disabled={Boolean(editingRoleID)} />
            <input placeholder="角色名称" value={roleForm.name} onChange={(event) => setRoleForm((v) => ({ ...v, name: event.target.value }))} required />
          </div>
          <div className="grid two mini-gap">
            <input placeholder="角色描述" value={roleForm.description} onChange={(event) => setRoleForm((v) => ({ ...v, description: event.target.value }))} />
            <input type="number" placeholder="角色等级" value={roleForm.level} onChange={(event) => setRoleForm((v) => ({ ...v, level: event.target.value }))} />
          </div>
          <div className="section-label">权限分配</div>
          <small className="field-hint" style={{ display: "none" }}>
            宸查€夋潈闄?{Array.isArray(roleForm.permissionIDs) ? roleForm.permissionIDs.length : 0} / {permissions.length}
          </small>
          <div className="section-label role-label-clean">{"\u6743\u9650\u5206\u914d"}</div>
          <small className="field-hint">
            {"\u5df2\u9009\u6743\u9650 "}{Array.isArray(roleForm.permissionIDs) ? roleForm.permissionIDs.length : 0} / {permissions.length}
          </small>
          <div className="permission-groups">
            {permissionGroups.map((group) => {
              const groupIDs = group.items.map((item) => item.id);
              const selectedCount = group.items.filter((item) => roleForm.permissionIDs.includes(item.id)).length;
              const groupAllSelected = group.items.length > 0 && selectedCount === group.items.length;
              return (
                <section className="permission-group-card" key={group.key}>
                  <div className="permission-group-head">
                    <strong>{group.label}</strong>
                    <small>{selectedCount}/{group.items.length}</small>
                    <div className="permission-group-actions">
                      <button className="btn tiny ghost" type="button" onClick={() => addPermissionGroup(groupIDs)} disabled={groupAllSelected} style={{ display: "none" }}>
                        鍏ㄩ€夋湰缁?
                      </button>
                      <button className="btn tiny ghost" type="button" onClick={() => addPermissionGroup(groupIDs)} disabled={groupAllSelected}>
                        {"\u5168\u9009\u672c\u7ec4"}
                      </button>
                      <button className="btn tiny ghost" type="button" onClick={() => removePermissionGroup(groupIDs)} disabled={selectedCount === 0} style={{ display: "none" }}>
                        娓呯┖鏈粍
                      </button>
                      <button className="btn tiny ghost" type="button" onClick={() => removePermissionGroup(groupIDs)} disabled={selectedCount === 0}>
                        {"\u6e05\u7a7a\u672c\u7ec4"}
                      </button>
                    </div>
                  </div>
                  <div className="permission-grid">
                    {group.items.map((permission) => (
                      <label className="check" key={permission.id}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(roleForm.permissionIDs) && roleForm.permissionIDs.includes(permission.id)}
                          onChange={() => setRoleForm((v) => ({ ...v, permissionIDs: toggleID(v.permissionIDs, permission.id) }))}
                        />
                        <span>{permission.code}</span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="section-label">命名空间授权</div>
          <div className="section-label role-label-clean">{"\u547d\u540d\u7a7a\u95f4\u6388\u6743"}</div>
          <div className="permission-grid">
            {namespaces.map((namespace) => (
              <label className="check" key={namespace.id}>
                <input type="checkbox" checked={roleForm.namespaceIDs.includes(namespace.id)} onChange={() => setRoleForm((v) => ({ ...v, namespaceIDs: toggleID(v.namespaceIDs, namespace.id) }))} />
                <span>{namespace.name}</span>
              </label>
            ))}
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              <ShieldPlus size={18} />
              <span>{editingRoleID ? "保存角色" : "创建角色"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeRoleModal} disabled={busy}>
              取消
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showNsModal}
        title={editingNamespaceID ? "编辑命名空间" : "新增命名空间"}
        subtitle={editingNamespaceID ? "更新命名空间配置" : "创建新的命名空间"}
        onClose={closeNsModal}
      >
        <form className="form-grid compact" onSubmit={(event) => { editingNamespaceID ? onUpdateNamespace(event) : onCreateNamespace(event); closeNsModal(); }}>
          <input placeholder="命名空间名称" value={namespaceForm.name} onChange={(event) => setNamespaceForm((v) => ({ ...v, name: event.target.value }))} required />
          <div className="grid two mini-gap">
            <select value={namespaceForm.storageConfigID} onChange={(event) => setNamespaceForm((v) => ({ ...v, storageConfigID: event.target.value }))}>
              <option value="">默认存储配置</option>
              {storageConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name} ({config.provider})
                </option>
              ))}
            </select>
            <input placeholder="命名空间描述" value={namespaceForm.description} onChange={(event) => setNamespaceForm((v) => ({ ...v, description: event.target.value }))} />
          </div>
          <div className="grid two mini-gap">
            <input placeholder="路径前缀" value={namespaceForm.pathPrefix} onChange={(event) => setNamespaceForm((v) => ({ ...v, pathPrefix: event.target.value }))} />
            <input type="number" min="1" placeholder="最大文件数" value={namespaceForm.maxFiles} onChange={(event) => setNamespaceForm((v) => ({ ...v, maxFiles: event.target.value }))} />
          </div>
          <div className="grid two mini-gap">
            <input type="number" min="1" placeholder="最大存储字节数" value={namespaceForm.maxStorage} onChange={(event) => setNamespaceForm((v) => ({ ...v, maxStorage: event.target.value }))} />
            <input type="number" min="1" placeholder="最大文件大小字节数" value={namespaceForm.maxFileSize} onChange={(event) => setNamespaceForm((v) => ({ ...v, maxFileSize: event.target.value }))} />
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {editingNamespaceID ? <Save size={18} /> : <Plus size={18} />}
              <span>{editingNamespaceID ? "保存命名空间" : "创建命名空间"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeNsModal} disabled={busy}>
              取消
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确认删除"
        subtitle={deleteTarget ? `即将删除：${deleteTarget.label}` : ""}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        confirmText="确认删除"
        cancelText="取消"
        danger
      />
    </section>
  );
}
