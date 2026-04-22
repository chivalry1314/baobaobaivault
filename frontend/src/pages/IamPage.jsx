import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

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
    return roles.filter((r) =>
      [r.name, r.code, r.description, ...(r.permissions || []).map((p) => p.code)].some((s) => String(s || "").toLowerCase().includes(q))
    );
  }, [roles, roleSearch]);

  const filteredNamespaces = useMemo(() => {
    const q = nsSearch.toLowerCase().trim();
    if (!q) return namespaces;
    return namespaces.filter((n) =>
      [n.name, n.id, n.pathPrefix, n.description].some((s) => String(s || "").toLowerCase().includes(q))
    );
  }, [namespaces, nsSearch]);

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

  return (
    <section id="section-iam" className="grid one">
      {showUsers && (
        <Panel title="用户管理" subtitle={`${users.length} 位用户`}>
          <div className="section-header">
            <div className="search-bar">
              <Icons.Search size={16} />
              <input placeholder="搜索用户名、邮箱、角色..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => { if (editingUserID) onCancelUserEdit(); setShowUserModal(true); }}>
              <Icons.UserPlus size={16} />
              新增用户
            </button>
          </div>

          {pagedUsers.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedUsers.map((item) => {
                  const roleCodes = (item.roles || []).map((r) => r.code);
                  const isAdmin = roleCodes.includes("tenant_admin") || roleCodes.includes("platform_admin");
                  return (
                    <div className="mini-row" key={item.id}>
                      <div>
                        <strong>
                          {item.username || "自动生成用户名"}
                          {isAdmin ? <span className="badge info">管理员</span> : null}
                        </strong>
                        <small>{item.email}</small>
                        <small>{roleCodes.join(", ") || "无角色"}</small>
                      </div>
                      <div className="actions-inline">
                        <button className="btn small ghost" type="button" onClick={() => { onEditUser(item); setShowUserModal(true); }}>编辑</button>
                        <button className="btn small danger" type="button" onClick={() => confirmDelete("user", item.id, item.username || item.email)} disabled={isAdmin} title={isAdmin ? "管理员用户不可删除" : ""}>
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
              <Icons.Users size={40} />
              <p>{userSearch ? "没有匹配的用户" : "暂无用户，点击新增"}</p>
            </div>
          )}
        </Panel>
      )}

      {showRoles && (
        <Panel title="角色管理" subtitle={`${roles.length} 个角色`} delay={80}>
          <div className="section-header">
            <div className="search-bar">
              <Icons.Search size={16} />
              <input placeholder="搜索角色名、编码、权限..." value={roleSearch} onChange={(e) => { setRoleSearch(e.target.value); setRolePage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => { setShowRoleModal(true); if (editingRoleID) onCancelRoleEdit(); }}>
              <Icons.ShieldPlus size={16} />
              新增角色
            </button>
          </div>

          {pagedRoles.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedRoles.map((role) => (
                  <div className="mini-row" key={role.id}>
                    <div>
                      <strong>{role.name} ({role.code})</strong>
                      <small>等级: {role.level} {role.is_system ? "系统角色" : "租户角色"}</small>
                      <small>{(role.permissions || []).map((p) => p.code).join(", ") || "无权限"}</small>
                      <small>命名空间: {(role.namespaces || []).length > 0 ? (role.namespaces || []).map((ns) => ns.name).join(", ") : "全部"}</small>
                    </div>
                    <div className="actions-inline">
                      <button className="btn small ghost" type="button" onClick={() => { onEditRole(role); setShowRoleModal(true); }} disabled={role.is_system || role.code === "tenant_admin"}>编辑</button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("role", role.id, `${role.name} (${role.code})`)} disabled={role.is_system || role.code === "tenant_admin"}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredRoles.length} page={rolePage} onChange={setRolePage} />
            </>
          ) : (
            <div className="empty-state">
              <Icons.ShieldCheck size={40} />
              <p>{roleSearch ? "没有匹配的角色" : "暂无角色，点击新增"}</p>
            </div>
          )}
        </Panel>
      )}

      {showNamespaces && (
        <Panel title="命名空间" subtitle={`${namespaces.length} 个命名空间`} delay={120}>
          <div className="section-header">
            <div className="search-bar">
              <Icons.Search size={16} />
              <input placeholder="搜索命名空间名称..." value={nsSearch} onChange={(e) => { setNsSearch(e.target.value); setNsPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowNsModal(true)}>
              <Icons.Plus size={16} />
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
                      <small>文件: {namespace.used_files || 0}{namespace.max_files ? ` / ${namespace.max_files}` : ""} | 存储: {namespace.used_storage || 0}{namespace.max_storage ? ` / ${namespace.max_storage}` : ""}</small>
                    </div>
                    <div className="actions-inline">
                      <button className="btn small ghost" type="button" onClick={() => { onEditNamespace(namespace); setShowNsModal(true); }}>编辑</button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("namespace", namespace.id, namespace.name)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredNamespaces.length} page={nsPage} onChange={setNsPage} />
            </>
          ) : (
            <div className="empty-state">
              <Icons.Layers size={40} />
              <p>{nsSearch ? "没有匹配的命名空间" : "暂无命名空间，点击新增"}</p>
            </div>
          )}
        </Panel>
      )}

      {/* ── 用户创建/编辑弹窗 ── */}
      <Modal open={showUserModal} title={editingUserID ? "编辑用户" : "新增用户"} subtitle={editingUserID ? "修改用户信息与角色分配" : "创建一个新的租户用户"} onClose={closeUserModal}>
        <form className="form-grid compact" onSubmit={(e) => { editingUserID ? onUpdateUser(e) : onCreateUser(e); closeUserModal(); }}>
          <div className="grid two mini-gap">
            <input placeholder="用户名 (可选)" value={userForm.username} onChange={(e) => setUserForm((v) => ({ ...v, username: e.target.value }))} disabled={Boolean(editingUserID)} />
            <input type="email" placeholder="邮箱地址" value={userForm.email} onChange={(e) => setUserForm((v) => ({ ...v, email: e.target.value }))} required />
          </div>
          <div className="grid two mini-gap">
            <input type="password" placeholder={editingUserID ? "新密码（留空不修改）" : "登录密码"} value={userForm.password} onChange={(e) => setUserForm((v) => ({ ...v, password: e.target.value }))} required={!editingUserID} />
            <input placeholder="显示昵称" value={userForm.nickname} onChange={(e) => setUserForm((v) => ({ ...v, nickname: e.target.value }))} />
          </div>
          <div className="section-label">分配角色</div>
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
              {editingUserID ? <Icons.Save size={18} /> : <Icons.UserPlus size={18} />}
              <span>{editingUserID ? "更新用户" : "创建用户"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeUserModal} disabled={busy}>取消</button>
          </div>
        </form>
      </Modal>

      {/* ── 角色创建/编辑弹窗 ── */}
      <Modal open={showRoleModal} title={editingRoleID ? "编辑角色" : "新增角色"} subtitle={editingRoleID ? "修改角色权限与空间范围" : "创建一个新的角色"} onClose={closeRoleModal}>
        <form className="form-grid compact" onSubmit={(e) => { onSubmitRole(e); closeRoleModal(); }}>
          <div className="grid two mini-gap">
            <input placeholder="角色编码 (Code)" value={roleForm.code} onChange={(e) => setRoleForm((v) => ({ ...v, code: e.target.value }))} required disabled={Boolean(editingRoleID)} />
            <input placeholder="角色名称" value={roleForm.name} onChange={(e) => setRoleForm((v) => ({ ...v, name: e.target.value }))} required />
          </div>
          <div className="grid two mini-gap">
            <input placeholder="角色描述" value={roleForm.description} onChange={(e) => setRoleForm((v) => ({ ...v, description: e.target.value }))} />
            <input type="number" placeholder="角色等级" value={roleForm.level} onChange={(e) => setRoleForm((v) => ({ ...v, level: e.target.value }))} />
          </div>
          <div className="section-label">权限分配</div>
          <div className="permission-grid">
            {permissions.map((permission) => (
              <label className="check" key={permission.id}>
                <input type="checkbox" checked={roleForm.permissionIDs.includes(permission.id)} onChange={() => setRoleForm((v) => ({ ...v, permissionIDs: toggleID(v.permissionIDs, permission.id) }))} />
                <span>{permission.code}</span>
              </label>
            ))}
          </div>
          <div className="section-label">管理空间范围</div>
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
              <Icons.ShieldPlus size={18} />
              <span>{editingRoleID ? "更新角色" : "创建角色"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeRoleModal} disabled={busy}>取消</button>
          </div>
        </form>
      </Modal>

      {/* ── 命名空间创建/编辑弹窗 ── */}
      <Modal open={showNsModal} title={editingNamespaceID ? "编辑命名空间" : "新增命名空间"} subtitle={editingNamespaceID ? "修改命名空间配置" : "创建一个新的存储命名空间"} onClose={closeNsModal}>
        <form className="form-grid compact" onSubmit={(e) => { editingNamespaceID ? onUpdateNamespace(e) : onCreateNamespace(e); closeNsModal(); }}>
          <input placeholder="命名空间名称" value={namespaceForm.name} onChange={(e) => setNamespaceForm((v) => ({ ...v, name: e.target.value }))} required />
          <div className="grid two mini-gap">
            <select value={namespaceForm.storageConfigID} onChange={(e) => setNamespaceForm((v) => ({ ...v, storageConfigID: e.target.value }))}>
              <option value="">使用租户默认存储</option>
              {storageConfigs.map((config) => (
                <option key={config.id} value={config.id}>{config.name} ({config.provider})</option>
              ))}
            </select>
            <input placeholder="命名空间描述" value={namespaceForm.description} onChange={(e) => setNamespaceForm((v) => ({ ...v, description: e.target.value }))} />
          </div>
          <div className="grid two mini-gap">
            <input placeholder="路径前缀" value={namespaceForm.pathPrefix} onChange={(e) => setNamespaceForm((v) => ({ ...v, pathPrefix: e.target.value }))} />
            <input type="number" min="1" placeholder="最大文件数" value={namespaceForm.maxFiles} onChange={(e) => setNamespaceForm((v) => ({ ...v, maxFiles: e.target.value }))} />
          </div>
          <div className="grid two mini-gap">
            <input type="number" min="1" placeholder="最大存储 (字节)" value={namespaceForm.maxStorage} onChange={(e) => setNamespaceForm((v) => ({ ...v, maxStorage: e.target.value }))} />
            <input type="number" min="1" placeholder="最大单文件 (字节)" value={namespaceForm.maxFileSize} onChange={(e) => setNamespaceForm((v) => ({ ...v, maxFileSize: e.target.value }))} />
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {editingNamespaceID ? <Icons.Save size={18} /> : <Icons.Plus size={18} />}
              <span>{editingNamespaceID ? "更新命名空间" : "创建命名空间"}</span>
            </button>
            <button className="btn ghost" type="button" onClick={closeNsModal} disabled={busy}>取消</button>
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
