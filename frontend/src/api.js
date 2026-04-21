const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

function normalizeResponse(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

async function request(path, { method = "GET", token, body, formData, raw = false } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  if (raw) {
    return response;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload?.message || response.statusText || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return normalizeResponse(payload);
}

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const apiBase = API_BASE;

export const api = {
  login(payload) {
    return request("/auth/login", { method: "POST", body: payload });
  },
  bootstrap(payload) {
    return request("/bootstrap/tenant-admin", { method: "POST", body: payload });
  },

  listTenants(token) {
    return request("/tenants", { token });
  },
  getTenant(token, tenantId) {
    return request(`/tenants/${tenantId}`, { token });
  },
  updateTenant(token, tenantId, payload) {
    return request(`/tenants/${tenantId}`, { method: "PUT", token, body: payload });
  },

  listUsers(token, params) {
    return request(`/users${buildQuery(params)}`, { token });
  },
  getUser(token, userId) {
    return request(`/users/${userId}`, { token });
  },
  createUser(token, payload, params) {
    return request(`/users${buildQuery(params)}`, { method: "POST", token, body: payload });
  },
  updateUser(token, userId, payload) {
    return request(`/users/${userId}`, { method: "PUT", token, body: payload });
  },
  deleteUser(token, userId) {
    return request(`/users/${userId}`, { method: "DELETE", token });
  },
  changePassword(token, payload) {
    return request("/users/me/password", { method: "PUT", token, body: payload });
  },
  listPermissions(token) {
    return request("/permissions", { token });
  },
  listRoles(token, params) {
    return request(`/roles${buildQuery(params)}`, { token });
  },
  createRole(token, payload, params) {
    return request(`/roles${buildQuery(params)}`, { method: "POST", token, body: payload });
  },
  updateRole(token, roleId, payload, params) {
    return request(`/roles/${roleId}${buildQuery(params)}`, { method: "PUT", token, body: payload });
  },
  deleteRole(token, roleId, params) {
    return request(`/roles/${roleId}${buildQuery(params)}`, { method: "DELETE", token });
  },

  listNamespaces(token, params) {
    return request(`/namespaces${buildQuery(params)}`, { token });
  },
  getNamespace(token, namespaceId) {
    return request(`/namespaces/${namespaceId}`, { token });
  },
  createNamespace(token, payload, params) {
    return request(`/namespaces${buildQuery(params)}`, { method: "POST", token, body: payload });
  },
  updateNamespace(token, namespaceId, payload) {
    return request(`/namespaces/${namespaceId}`, { method: "PUT", token, body: payload });
  },
  deleteNamespace(token, namespaceId) {
    return request(`/namespaces/${namespaceId}`, { method: "DELETE", token });
  },

  listStorageConfigs(token, params) {
    return request(`/storage/configs${buildQuery(params)}`, { token });
  },
  createStorageConfig(token, payload, params) {
    return request(`/storage/configs${buildQuery(params)}`, { method: "POST", token, body: payload });
  },
  deleteStorageConfig(token, id, params) {
    return request(`/storage/configs/${id}${buildQuery(params)}`, { method: "DELETE", token });
  },

  listObjects(token, params) {
    return request(`/storage/objects${buildQuery(params)}`, { token });
  },
  listObjectVersions(token, params) {
    return request(`/storage/objects/versions${buildQuery(params)}`, { token });
  },
  rollbackObjectVersion(token, payload) {
    return request("/storage/objects/versions/rollback", { method: "POST", token, body: payload });
  },
  uploadObject(token, formData) {
    return request("/storage/objects/upload", { method: "POST", token, formData });
  },
  deleteObject(token, params) {
    return request(`/storage/objects${buildQuery(params)}`, { method: "DELETE", token });
  },
  presignGet(token, params) {
    return request(`/storage/objects/presign-get${buildQuery(params)}`, { token });
  },
  presignPut(token, params) {
    return request(`/storage/objects/presign-put${buildQuery(params)}`, { token });
  },
  completePresignPut(token, payload) {
    return request("/storage/objects/presign-put/complete", { method: "POST", token, body: payload });
  },
  async downloadObject(token, params) {
    const response = await request(`/storage/objects/download${buildQuery(params)}`, {
      token,
      raw: true,
    });
    if (!response.ok) {
      let msg = "下载失败";
      try {
        const payload = await response.json();
        msg = payload?.error || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^\"]+)\"?/i);
    const filename = match?.[1] || params.key || "下载文件.bin";
    return { blob, filename };
  },

  listAKSK(token) {
    return request("/auth/aksk", { token });
  },
  createAKSK(token, payload) {
    return request("/auth/aksk", { method: "POST", token, body: payload });
  },
  revokeAKSK(token, id) {
    return request(`/auth/aksk/${id}`, { method: "DELETE", token });
  },

  listAuditLogs(token, params) {
    return request(`/audit/logs${buildQuery(params)}`, { token });
  },
};
