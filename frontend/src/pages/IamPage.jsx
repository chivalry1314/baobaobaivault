import Panel from "../components/Panel";

export default function IamPage({
  users,
  userForm,
  setUserForm,
  roles,
  permissions,
  namespaces,
  storageConfigs,
  roleForm,
  setRoleForm,
  editingRoleID,
  namespaceForm,
  setNamespaceForm,
  busy,
  toggleID,
  onCreateUser,
  onDeleteUser,
  onSubmitRole,
  onCancelRoleEdit,
  onDeleteRole,
  onEditRole,
  onCreateNamespace,
  onDeleteNamespace,
}) {
  return (
    <section id="section-iam" className="grid three">
      <Panel title="用户管理" subtitle={`${users.length} 位用户`}>
        <form className="form-grid compact" onSubmit={onCreateUser}>
          <input
            placeholder="用户名（可选，不填则自动生成）"
            value={userForm.username}
            onChange={(e) => setUserForm((v) => ({ ...v, username: e.target.value }))}
          />
          <input
            type="email"
            placeholder="邮箱"
            value={userForm.email}
            onChange={(e) => setUserForm((v) => ({ ...v, email: e.target.value }))}
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={userForm.password}
            onChange={(e) => setUserForm((v) => ({ ...v, password: e.target.value }))}
            required
          />
          <input
            placeholder="昵称"
            value={userForm.nickname}
            onChange={(e) => setUserForm((v) => ({ ...v, nickname: e.target.value }))}
          />

          <div className="permission-grid">
            {roles.map((role) => (
              <label className="check" key={role.id}>
                <input
                  type="checkbox"
                  checked={Array.isArray(userForm.roleIDs) && userForm.roleIDs.includes(role.id)}
                  onChange={() => setUserForm((v) => ({ ...v, roleIDs: toggleID(v.roleIDs, role.id) }))}
                />
                {role.name}
              </label>
            ))}
          </div>

          <button className="btn primary" type="submit" disabled={busy}>
            创建用户
          </button>
        </form>

        <div className="mini-table">
          {users.map((item) => (
            <div className="mini-row" key={item.id}>
              <div>
                <strong>{item.username || "自动生成用户名"}</strong>
                <small>{item.email}</small>
                <small>{(item.roles || []).map((role) => role.code).join(", ") || "无角色"}</small>
              </div>
              <button className="btn small danger" type="button" onClick={() => void onDeleteUser(item.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="角色管理" subtitle={`${roles.length} 个角色`} delay={80}>
        <form className="form-grid compact" onSubmit={onSubmitRole}>
          <input
            placeholder="角色编码"
            value={roleForm.code}
            onChange={(e) => setRoleForm((v) => ({ ...v, code: e.target.value }))}
            required
            disabled={Boolean(editingRoleID)}
          />
          <input
            placeholder="角色名称"
            value={roleForm.name}
            onChange={(e) => setRoleForm((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <input
            placeholder="角色描述"
            value={roleForm.description}
            onChange={(e) => setRoleForm((v) => ({ ...v, description: e.target.value }))}
          />
          <input
            type="number"
            placeholder="角色等级"
            value={roleForm.level}
            onChange={(e) => setRoleForm((v) => ({ ...v, level: e.target.value }))}
          />

          <div className="permission-grid">
            {permissions.map((permission) => (
              <label className="check" key={permission.id}>
                <input
                  type="checkbox"
                  checked={roleForm.permissionIDs.includes(permission.id)}
                  onChange={() => setRoleForm((v) => ({ ...v, permissionIDs: toggleID(v.permissionIDs, permission.id) }))}
                />
                {permission.code}
              </label>
            ))}
          </div>

          <div className="permission-grid">
            {namespaces.map((namespace) => (
              <label className="check" key={namespace.id}>
                <input
                  type="checkbox"
                  checked={roleForm.namespaceIDs.includes(namespace.id)}
                  onChange={() => setRoleForm((v) => ({ ...v, namespaceIDs: toggleID(v.namespaceIDs, namespace.id) }))}
                />
                命名空间: {namespace.name}
              </label>
            ))}
          </div>

          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {editingRoleID ? "更新角色" : "创建角色"}
            </button>
            {editingRoleID ? (
              <button className="btn ghost" type="button" onClick={onCancelRoleEdit} disabled={busy}>
                取消编辑
              </button>
            ) : null}
          </div>
        </form>

        <div className="mini-table">
          {roles.map((role) => (
            <div className="mini-row" key={role.id}>
              <div>
                <strong>
                  {role.name} ({role.code})
                </strong>
                <small>
                  等级: {role.level} {role.is_system ? "系统角色" : "租户角色"}
                </small>
                <small>{(role.permissions || []).map((permission) => permission.code).join(", ") || "无权限"}</small>
                <small>
                  命名空间范围: {(role.namespaces || []).length > 0 ? (role.namespaces || []).map((ns) => ns.name).join(", ") : "全部命名空间"}
                </small>
              </div>
              <div className="actions-inline">
                <button
                  className="btn small ghost"
                  type="button"
                  onClick={() => onEditRole(role)}
                  disabled={role.is_system || role.code === "tenant_admin"}
                >
                  编辑
                </button>
                <button
                  className="btn small danger"
                  type="button"
                  onClick={() => void onDeleteRole(role.id)}
                  disabled={role.is_system || role.code === "tenant_admin"}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="命名空间" subtitle={`${namespaces.length} 个命名空间`} delay={120}>
        <form className="form-grid compact" onSubmit={onCreateNamespace}>
          <input
            placeholder="命名空间名称"
            value={namespaceForm.name}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <input
            placeholder="命名空间描述"
            value={namespaceForm.description}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, description: e.target.value }))}
          />

          <select value={namespaceForm.storageConfigID} onChange={(e) => setNamespaceForm((v) => ({ ...v, storageConfigID: e.target.value }))}>
            <option value="">使用租户默认存储</option>
            {storageConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name} ({config.provider})
              </option>
            ))}
          </select>

          <input
            placeholder="路径前缀"
            value={namespaceForm.pathPrefix}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, pathPrefix: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="最大存储字节数（可选）"
            value={namespaceForm.maxStorage}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, maxStorage: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="最大文件数（可选）"
            value={namespaceForm.maxFiles}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, maxFiles: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="最大文件大小字节数（可选）"
            value={namespaceForm.maxFileSize}
            onChange={(e) => setNamespaceForm((v) => ({ ...v, maxFileSize: e.target.value }))}
          />

          <button className="btn primary" type="submit" disabled={busy}>
            创建命名空间
          </button>
        </form>

        <div className="mini-table">
          {namespaces.map((namespace) => (
            <div className="mini-row" key={namespace.id}>
              <div>
                <strong>{namespace.name}</strong>
                <small>{namespace.id}</small>
                <small>
                  文件: {namespace.used_files || 0}
                  {namespace.max_files ? ` / ${namespace.max_files}` : ""} | 存储: {namespace.used_storage || 0}
                  {namespace.max_storage ? ` / ${namespace.max_storage}` : ""}
                </small>
              </div>
              <button className="btn small danger" type="button" onClick={() => void onDeleteNamespace(namespace.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
