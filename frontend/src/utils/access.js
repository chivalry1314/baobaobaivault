export function collectRoleCodes(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const codes = new Set();
  roles.forEach((role) => {
    const code = String(role?.code || "").trim();
    if (code) {
      codes.add(code);
    }
  });
  return codes;
}

export function collectPermissionCodes(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const codes = new Set();
  roles.forEach((role) => {
    const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
    permissions.forEach((permission) => {
      const code = String(permission?.code || "").trim();
      if (code) {
        codes.add(code);
      }
    });
  });
  return codes;
}

export function isPlatformAdmin(user) {
  return collectRoleCodes(user).has("platform_admin");
}

export function isTenantAdmin(user) {
  return collectRoleCodes(user).has("tenant_admin");
}

function hasAnyPermission(user, permissionCodes) {
  const targetCodes = Array.isArray(permissionCodes) ? permissionCodes : [];
  if (targetCodes.length === 0) return true;
  if (isPlatformAdmin(user) || isTenantAdmin(user)) return true;

  const permissionSet = collectPermissionCodes(user);
  return targetCodes.some((code) => permissionSet.has(code));
}

const pagePermissionMap = {
  overview: [],
  profile: [],
  account: [],
  "iam-users": ["user:list", "user:admin", "user:update"],
  "iam-roles": ["user:admin", "user:update"],
  "iam-namespaces": ["namespace:list", "namespace:admin", "user:admin"],
  "storage-config": ["storage:list", "storage:admin"],
  "storage-objects": ["object:list", "object:admin", "namespace:list"],
  audit: ["tenant:read", "tenant:admin"],
  tenant: ["tenant:read", "tenant:update", "tenant:admin"],
  settings: [],
};

export function canAccessPage(user, pageKey) {
  const key = String(pageKey || "").trim();
  if (!key) return false;
  if (!(key in pagePermissionMap)) return false;
  return hasAnyPermission(user, pagePermissionMap[key]);
}

export function filterNavItemsByAccess(items, user) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => {
      const children = Array.isArray(item?.children) ? item.children : [];
      if (children.length === 0) {
        return canAccessPage(user, item?.key) ? item : null;
      }

      const visibleChildren = children.filter((child) => canAccessPage(user, child?.key));
      if (visibleChildren.length === 0) {
        return null;
      }

      return {
        ...item,
        children: visibleChildren,
      };
    })
    .filter(Boolean);
}
