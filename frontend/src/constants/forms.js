export const TOKEN_KEY = "bv_token";
export const USER_KEY = "bv_user";
export const TENANT_KEY = "bv_tenant";

export const emptyBootstrap = {
  tenantName: "",
  tenantCode: "",
  tenantDescription: "",
  adminUsername: "",
  adminEmail: "",
  adminPassword: "",
  adminNickname: "",
};

export const emptyLogin = { tenantCode: "", email: "", password: "" };
export const emptyUserForm = { username: "", email: "", password: "", nickname: "", roleIDs: [] };
export const emptyRoleForm = { code: "", name: "", description: "", level: 10, permissionIDs: [], namespaceIDs: [] };
export const emptyNamespaceForm = { name: "", description: "", storageConfigID: "", pathPrefix: "", maxStorage: "", maxFiles: "", maxFileSize: "" };
export const emptyStorageForm = {
  name: "",
  provider: "local",
  endpoint: "",
  region: "",
  bucket: "",
  accessKey: "",
  secretKey: "",
  pathStyle: false,
  isDefault: true,
  extraConfig: "",
};
export const emptyObjectForm = { key: "", contentType: "", metadata: "" };
export const emptyAkskForm = { description: "", expiresInDays: 30 };
export const emptyPasswordForm = { oldPassword: "", newPassword: "" };
export const emptyAuditFilter = { action: "", resource: "", status: "", user_id: "", resource_id: "", from: "", to: "" };
