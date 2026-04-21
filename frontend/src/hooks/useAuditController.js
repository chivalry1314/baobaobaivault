import { useState } from "react";
import { api } from "../api";
import { emptyAuditFilter } from "../constants/forms";

function buildTenantParams(isPlatformAdmin, tenantID) {
  if (!isPlatformAdmin || !tenantID) return undefined;
  return { tenant_id: tenantID };
}

export default function useAuditController({ token, tenantID, isPlatformAdmin, act }) {
  const [auditFilter, setAuditFilter] = useState(emptyAuditFilter);
  const [auditLogs, setAuditLogs] = useState([]);

  async function loadAuditLogs(filters = auditFilter) {
    const page = await api.listAuditLogs(token, {
      page: 1,
      page_size: 50,
      ...buildTenantParams(isPlatformAdmin, tenantID),
      ...filters,
    });
    setAuditLogs(page?.items || []);
  }

  async function onApplyAuditFilter(event) {
    event.preventDefault();
    await act(() => loadAuditLogs(auditFilter));
  }

  async function onResetAuditFilter() {
    setAuditFilter(emptyAuditFilter);
    await act(() => loadAuditLogs(emptyAuditFilter));
  }

  function resetAudit() {
    setAuditFilter(emptyAuditFilter);
    setAuditLogs([]);
  }

  return {
    auditFilter,
    setAuditFilter,
    auditLogs,
    loadAuditLogs,
    onApplyAuditFilter,
    onResetAuditFilter,
    resetAudit,
  };
}
