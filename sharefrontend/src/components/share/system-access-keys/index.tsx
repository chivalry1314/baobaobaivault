"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  ShareAccessKeyItem,
  ShareSystemAccessKeyCreateResult,
  ShareSystemAccessKeyOwner,
} from "@/lib/shared";

const PAGE_SIZE = 10;

const emptyForm = {
  description: "",
  expiresInDays: "0",
};

export function ShareSystemAccessKeysPage() {
  const { user, sessionChecking } = useShareSession();
  const [items, setItems] = useState<ShareAccessKeyItem[]>([]);
  const [owner, setOwner] = useState<ShareSystemAccessKeyOwner | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadAccessKeys();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length]);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  async function loadAccessKeys() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemAccessKeys();
      setItems(response.items || []);
      setOwner(response.owner || null);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载访问密钥失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(item: ShareAccessKeyItem) {
    const confirmed = window.confirm(`确认吊销访问密钥 ${item.access_key} 吗？`);
    if (!confirmed) {
      return;
    }
    setRevokingId(item.id);
    setActionError("");
    setSuccessMessage("");
    try {
      await shareApi.revokeSystemAccessKey(item.id);
      setSuccessMessage("访问密钥已吊销。");
      await loadAccessKeys();
    } catch (error) {
      setActionError(getShareErrorMessage(error, "吊销访问密钥失败，请稍后重试。"));
    } finally {
      setRevokingId("");
    }
  }

  if (sessionChecking) {
    return <SystemLoadingPage currentPath="/system/access-keys" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/access-keys" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/access-keys" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/access-keys"
      title="访问密钥"
      description={`管理平台管理员账号的 AK/SK，用于服务端签名调用和程序化访问。${owner ? ` 当前绑定平台账号：${owner.nickname || owner.username || owner.email} / ${owner.email}` : ""}`}
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      <section className="dream-panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">已有密钥</h2>
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]/65">
              第 {safePage} / {totalPages} 页，共 {items.length} 个密钥
            </p>
          </div>
          <Link href="/system/access-keys/new" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black">
            创建密钥
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm font-bold text-[var(--foreground)]/65">正在加载访问密钥...</p>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[rgba(120,85,94,0.22)] px-4 py-5 text-sm font-bold text-[var(--foreground)]/65">
              <p>暂时还没有访问密钥。</p>
              <Link href="/system/access-keys/new" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                去创建第一组密钥
              </Link>
            </div>
          ) : (
            pagedItems.map((item) => (
              <article key={item.id} className="dream-panel-soft rounded-[22px] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-all text-base font-black text-[var(--foreground)]">{item.access_key}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "active" ? "bg-[rgba(199,244,214,0.9)] text-[#2f6d37]" : "bg-[rgba(255,230,224,0.9)] text-[#b64031]"}`}>
                        {item.status || "unknown"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-[var(--foreground)]/68">描述：{item.description || "未填写"}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">过期时间：{formatDateTime(item.expires_at)}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">创建时间：{formatDateTime(item.created_at)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleRevoke(item)}
                    disabled={revokingId === item.id || item.status === "revoked"}
                    className="rounded-full bg-[#c94c3b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {revokingId === item.id ? "吊销中..." : item.status === "revoked" ? "已吊销" : "吊销"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={(nextPage) => {
            setPage(Math.min(Math.max(nextPage, 1), totalPages));
          }}
          className="mt-6"
        />
      </section>
    </SystemWorkspace>
  );
}

export function ShareSystemAccessKeysCreatePage() {
  const { user, sessionChecking } = useShareSession();
  const [owner, setOwner] = useState<ShareSystemAccessKeyOwner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lastCreated, setLastCreated] = useState<ShareSystemAccessKeyCreateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadOwner();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  async function loadOwner() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await shareApi.systemAccessKeys();
      setOwner(response.owner || null);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载访问密钥上下文失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setSuccessMessage("");
    try {
      const response = await shareApi.createSystemAccessKey({
        description: form.description.trim(),
        expires_in_days: Number(form.expiresInDays) || 0,
      });
      setLastCreated(response.item);
      setForm(emptyForm);
      setSuccessMessage("访问密钥已创建。Secret Key 仅展示这一次，请立即保存。");
    } catch (error) {
      setActionError(getShareErrorMessage(error, "创建访问密钥失败，请稍后重试。"));
    } finally {
      setSaving(false);
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/access-keys" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/access-keys/new" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/access-keys" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/access-keys"
      title="创建访问密钥"
      description={`为平台管理员账号单独创建一组新的 AK/SK。${owner ? ` 当前绑定平台账号：${owner.nickname || owner.username || owner.email} / ${owner.email}` : ""}`}
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}

      {lastCreated ? (
        <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
          <h2 className="text-xl font-black text-[var(--foreground)]">新创建的密钥</h2>
          <div className="mt-4 rounded-[24px] bg-[rgba(255,248,230,0.92)] px-5 py-5 text-sm font-bold leading-7 text-[#8a5a00]">
            <p>Access Key：{lastCreated.access_key}</p>
            <p className="mt-2 break-all">Secret Key：{lastCreated.secret_key}</p>
            <p className="mt-2 text-xs">注意：Secret Key 只会返回这一轮。</p>
          </div>
        </section>
      ) : null}

      <section className="dream-panel max-w-3xl px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4">
          <h2 className="text-xl font-black text-[var(--foreground)]">创建表单</h2>
          <Link href="/system/access-keys" className="btn-subtle inline-flex rounded-full px-4 py-2 text-sm font-black">
            返回列表
          </Link>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleCreate}>
          <TextField
            label="用途描述"
            value={form.description}
            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
            placeholder="例如：服务端备份任务"
          />
          <TextField
            label="有效期天数"
            value={form.expiresInDays}
            onChange={(value) => setForm((current) => ({ ...current, expiresInDays: value }))}
            placeholder="0 表示不过期"
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "创建中..." : "创建访问密钥"}
            </button>
            <Link href="/system/access-keys" className="btn-subtle inline-flex rounded-full px-6 py-3 text-sm font-black">
              返回列表
            </Link>
          </div>
        </form>
      </section>
    </SystemWorkspace>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "不过期";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function SystemLoadingPage({ currentPath, text }: { currentPath: string; text: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description={text}>
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="dream-panel px-6 py-8">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">
          当前账号不是系统初始化超级管理员，无法访问此页面。
        </p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">{message}</p>;
}

function SuccessNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#d9eed6] bg-[#f3fbf1] px-5 py-4 text-sm font-bold text-[#2f6d37]">{message}</p>;
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="dream-input w-full px-4 py-3" />
    </label>
  );
}
