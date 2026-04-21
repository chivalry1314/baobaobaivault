import { useEffect, useState } from "react";
import { api } from "../api";
import { parseOptionalPositiveInt } from "../utils/data";

function buildTenantForm(tenant) {
  return {
    name: tenant?.name || "",
    description: tenant?.description || "",
    maxStorage: tenant?.max_storage ? String(tenant.max_storage) : "",
    maxUsers: tenant?.max_users ? String(tenant.max_users) : "",
    maxNamespaces: tenant?.max_namespaces ? String(tenant.max_namespaces) : "",
    maxApiCalls: tenant?.max_api_calls ? String(tenant.max_api_calls) : "",
  };
}

function validatePositiveInteger(text) {
  const value = String(text ?? "").trim();
  if (!value) return { valid: true, number: undefined };
  if (!/^\d+$/.test(value)) return { valid: false, number: undefined };

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return { valid: false, number: undefined };
  return { valid: true, number: parsed };
}

function validateTenantForm(form, tenant) {
  const errors = {};

  const name = String(form.name ?? "").trim();
  if (!name) {
    errors.name = "租户名称不能为空";
  } else if (name.length > 64) {
    errors.name = "租户名称不能超过 64 个字符";
  }

  const description = String(form.description ?? "").trim();
  if (description.length > 500) {
    errors.description = "租户描述不能超过 500 个字符";
  }

  const quotaRules = [
    { field: "maxStorage", label: "最大存储字节数", usedKey: "used_storage" },
    { field: "maxUsers", label: "最大用户数", usedKey: "used_users" },
    { field: "maxNamespaces", label: "最大命名空间数", usedKey: "used_namespaces" },
    { field: "maxApiCalls", label: "最大 API 调用数", usedKey: "used_api_calls" },
  ];

  quotaRules.forEach((rule) => {
    const result = validatePositiveInteger(form[rule.field]);
    if (!result.valid) {
      errors[rule.field] = `${rule.label}必须是大于 0 的整数`;
      return;
    }

    if (result.number === undefined) return;

    const used = Number(tenant?.[rule.usedKey]) || 0;
    if (used > result.number) {
      errors[rule.field] = `${rule.label}不能小于当前已使用值 ${used.toLocaleString()}`;
    }
  });

  return errors;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}

function formatChangeValue(value, asNumber = false) {
  if (value === undefined || value === null || value === "") return "未设置";
  if (asNumber) return (Number(value) || 0).toLocaleString();
  return String(value);
}

function buildTenantChanges(tenant, payload) {
  const items = [
    {
      label: "租户名称",
      before: String(tenant?.name ?? "").trim(),
      after: String(payload.name ?? "").trim(),
      asNumber: false,
    },
    {
      label: "租户描述",
      before: String(tenant?.description ?? "").trim(),
      after: String(payload.description ?? "").trim(),
      asNumber: false,
    },
    {
      label: "最大存储字节数",
      before: normalizeLimit(tenant?.max_storage),
      after: payload.max_storage,
      asNumber: true,
    },
    {
      label: "最大用户数",
      before: normalizeLimit(tenant?.max_users),
      after: payload.max_users,
      asNumber: true,
    },
    {
      label: "最大命名空间数",
      before: normalizeLimit(tenant?.max_namespaces),
      after: payload.max_namespaces,
      asNumber: true,
    },
    {
      label: "最大 API 调用数",
      before: normalizeLimit(tenant?.max_api_calls),
      after: payload.max_api_calls,
      asNumber: true,
    },
  ];

  return items
    .filter((item) => item.before !== item.after)
    .map((item) => ({
      label: item.label,
      beforeText: formatChangeValue(item.before, item.asNumber),
      afterText: formatChangeValue(item.after, item.asNumber),
    }));
}

export default function useTenantController({ token, tenant, act, saveTenant, loadTenant }) {
  const [tenantForm, setTenantForm] = useState(buildTenantForm(tenant));
  const [formErrors, setFormErrors] = useState({});
  const [hint, setHint] = useState("");
  const [pendingPayload, setPendingPayload] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);

  useEffect(() => {
    setTenantForm(buildTenantForm(tenant));
    setFormErrors({});
    setHint("");
    setPendingPayload(null);
    setPendingChanges([]);
  }, [tenant]);

  function onTenantFieldChange(field, value) {
    setTenantForm((prev) => ({ ...prev, [field]: value }));
    setHint("");
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function onUpdateTenant(event) {
    event.preventDefault();
    if (!tenant?.id) return;

    const errors = validateTenantForm(tenantForm, tenant);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = {
      name: tenantForm.name.trim(),
      description: tenantForm.description.trim(),
      max_storage: parseOptionalPositiveInt(tenantForm.maxStorage),
      max_users: parseOptionalPositiveInt(tenantForm.maxUsers),
      max_namespaces: parseOptionalPositiveInt(tenantForm.maxNamespaces),
      max_api_calls: parseOptionalPositiveInt(tenantForm.maxApiCalls),
    };

    const changes = buildTenantChanges(tenant, payload);
    if (changes.length === 0) {
      setHint("未检测到变更，无需保存。");
      setPendingPayload(null);
      setPendingChanges([]);
      return;
    }

    setHint("");
    setPendingPayload(payload);
    setPendingChanges(changes);
  }

  function cancelPendingUpdate() {
    setPendingPayload(null);
    setPendingChanges([]);
  }

  async function confirmPendingUpdate() {
    if (!tenant?.id || !pendingPayload) return;

    const result = await act(() => api.updateTenant(token, tenant.id, pendingPayload), "租户配置已更新");
    if (!result) return;

    cancelPendingUpdate();
    setHint("");

    if (result?.id) {
      saveTenant(result);
    } else {
      await loadTenant();
    }
  }

  return {
    tenantForm,
    formErrors,
    hint,
    pendingChanges,
    hasPendingConfirm: pendingChanges.length > 0,
    onTenantFieldChange,
    onUpdateTenant,
    cancelPendingUpdate,
    confirmPendingUpdate,
  };
}
