"use client";

import { useEffect, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareAuthSettings, ShareEmailHealth } from "@/lib/shared";

export function ShareSystemAuthSettingsPage() {
  const { user, sessionChecking } = useShareSession();
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [authSettings, setAuthSettings] = useState<ShareAuthSettings | null>(null);
  const [authSettingsDraft, setAuthSettingsDraft] = useState<ShareAuthSettings | null>(null);
  const [authSettingsPending, setAuthSettingsPending] = useState(false);
  const [authSettingsMessage, setAuthSettingsMessage] = useState("");
  const [emailHealth, setEmailHealth] = useState<ShareEmailHealth | null>(null);
  const [smtpTestPending, setSMTPTestPending] = useState(false);
  const [smtpTestMessage, setSMTPTestMessage] = useState("");
  const [smtpTestTargetEmail, setSMTPTestTargetEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user?.isConfiguredSuperAdmin) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  useEffect(() => {
    if (!user) {
      setSMTPTestTargetEmail("");
      return;
    }
    setSMTPTestTargetEmail((current) => (current.trim() ? current : user.email));
  }, [user?.email]);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [authConfigResponse, emailHealthResponse, authSettingsResponse] = await Promise.all([
        shareApi.authConfig(),
        shareApi.emailHealth(),
        shareApi.systemAuthSettings(),
      ]);
      setEmailVerificationEnabled(authConfigResponse.config.emailVerificationEnabled);
      setEmailHealth(emailHealthResponse.health);
      setAuthSettings(authSettingsResponse.settings);
      setAuthSettingsDraft(authSettingsResponse.settings);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载认证设置失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  function updateAuthSettingsDraft(patch: Partial<ShareAuthSettings>) {
    setAuthSettingsDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, ...patch };
    });
    setAuthSettingsMessage("");
  }

  async function handleSaveAuthSettings() {
    if (!authSettingsDraft || authSettingsPending) {
      return;
    }

    setAuthSettingsPending(true);
    setAuthSettingsMessage("");
    try {
      const response = await shareApi.updateSystemAuthSettings({
        emailVerificationEnabled: authSettingsDraft.emailVerificationEnabled,
        verificationCodeTTLSeconds: authSettingsDraft.verificationCodeTTLSeconds,
        resendIntervalSeconds: authSettingsDraft.resendIntervalSeconds,
        maxVerifyAttempts: authSettingsDraft.maxVerifyAttempts,
      });
      setAuthSettings(response.settings);
      setAuthSettingsDraft(response.settings);
      setEmailVerificationEnabled(response.settings.emailVerificationEnabled);
      setAuthSettingsMessage("邮箱注册策略已保存。");
    } catch (error) {
      setAuthSettingsMessage(getShareErrorMessage(error, "保存邮箱注册策略失败，请稍后重试。"));
    } finally {
      setAuthSettingsPending(false);
    }
  }

  async function handleSMTPTest() {
    if (smtpTestPending) {
      return;
    }

    const targetEmail = smtpTestTargetEmail.trim();
    if (!targetEmail) {
      setSMTPTestMessage("请先填写测试收件邮箱");
      return;
    }

    setSMTPTestPending(true);
    setSMTPTestMessage("");
    try {
      const response = await shareApi.sendSystemSMTPTestEmail({ targetEmail });
      setSMTPTestMessage(`测试邮件已发送至 ${response.targetEmail}`);
    } catch (error) {
      setSMTPTestMessage(getShareErrorMessage(error, "测试邮件发送失败，请稍后重试。"));
    } finally {
      setSMTPTestPending(false);
    }
  }

  if (sessionChecking || loading) {
    return <SystemLoadingPage currentPath="/system/auth-settings" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system/auth-settings" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return <SystemForbiddenPage currentPath="/system/auth-settings" />;
  }

  return (
    <SystemWorkspace
      currentPath="/system/auth-settings"
      title="认证设置"
      description="集中维护站点级认证策略、邮箱验证流程与 SMTP 发信状态。这里的配置会直接影响新用户注册体验。"
    >
      {loadError ? <ErrorNotice message={loadError} /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="dream-panel px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className={`inline-block h-3 w-3 rounded-full ${emailVerificationEnabled ? "bg-[#0f9d77]" : "bg-[#f0a33e]"}`} />
                <h2 className="text-xl font-black text-[var(--foreground)]">邮箱验证状态</h2>
              </div>
              <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">
                {emailVerificationEnabled
                  ? "当前已开启邮箱验证码注册，新用户需要先完成邮箱验证后才能创建账号。"
                  : "当前未开启邮箱验证码注册，新用户注册成功后会直接创建账号并登录。"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSMTPTest()}
              disabled={smtpTestPending}
              className="btn-subtle rounded-full px-5 py-3 text-sm font-black text-[var(--foreground)]/76 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {smtpTestPending ? "发送中..." : "发送 SMTP 测试邮件"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SelectField
              label="注册必须邮箱激活"
              value={authSettingsDraft?.emailVerificationEnabled ? "enabled" : "disabled"}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              options={[
                { label: "开启", value: "enabled" },
                { label: "关闭", value: "disabled" },
              ]}
              onChange={(value) =>
                updateAuthSettingsDraft({
                  emailVerificationEnabled: value === "enabled",
                })
              }
            />

            <NumberField
              label="验证码有效期（秒）"
              value={authSettingsDraft?.verificationCodeTTLSeconds ?? 600}
              min={300}
              max={1800}
              step={30}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              onChange={(value) =>
                updateAuthSettingsDraft({
                  verificationCodeTTLSeconds: value,
                })
              }
            />

            <NumberField
              label="重发间隔（秒）"
              value={authSettingsDraft?.resendIntervalSeconds ?? 60}
              min={30}
              max={300}
              step={5}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              onChange={(value) =>
                updateAuthSettingsDraft({
                  resendIntervalSeconds: value,
                })
              }
            />

            <NumberField
              label="最大验证次数"
              value={authSettingsDraft?.maxVerifyAttempts ?? 5}
              min={3}
              max={10}
              step={1}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              onChange={(value) =>
                updateAuthSettingsDraft({
                  maxVerifyAttempts: value,
                })
              }
            />
          </div>

          <div className="mt-6 rounded-[24px] bg-[rgba(248,252,255,0.88)] px-4 py-4 text-xs font-bold leading-6 text-[var(--foreground)]/60">
            仅系统初始化超级管理员可修改。建议：有效期 300-1800 秒，重发间隔 30-300 秒，并且必须小于验证码有效期。
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveAuthSettings()}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authSettingsPending ? "保存中..." : "保存邮箱注册策略"}
            </button>
            {authSettingsMessage ? (
              <span className="text-sm font-bold text-[var(--foreground)]/72">{authSettingsMessage}</span>
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <section className="dream-panel px-6 py-6">
            <h2 className="text-xl font-black text-[var(--foreground)]">测试发信</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-[var(--foreground)]/68">
              发送一封测试邮件，快速确认 SMTP 账户、网络和发件配置是否可用。
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">测试收件邮箱</span>
              <input
                type="email"
                value={smtpTestTargetEmail}
                onChange={(event) => setSMTPTestTargetEmail(event.target.value)}
                className="dream-input w-full px-4 py-3"
                placeholder="请输入要接收测试邮件的邮箱"
              />
            </label>
            {smtpTestMessage ? <p className="mt-4 text-sm font-bold text-[var(--foreground)]/72">{smtpTestMessage}</p> : null}
          </section>

          <section className="dream-panel px-6 py-6">
            <h2 className="text-xl font-black text-[var(--foreground)]">SMTP 健康状态</h2>
            <div className="mt-5 grid gap-3">
              <MetricCard label="SMTP 服务" value={emailHealth?.enabled ? "已启用" : "未启用"} />
              <MetricCard label="发件地址" value={emailHealth?.fromAddress || "未配置"} breakAll />
              <MetricCard
                label="SMTP 主机"
                value={`${emailHealth?.smtpHost || "未配置"}${emailHealth && emailHealth.smtpPort > 0 ? `:${emailHealth.smtpPort}` : ""}`}
                breakAll
              />
            </div>
          </section>
        </section>
      </section>
    </SystemWorkspace>
  );
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
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="dream-panel-soft border-[#f3c8ad] bg-[#fff4ec] px-5 py-4 text-sm font-bold text-[#9a3412]">{message}</p>;
}

function MetricCard(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-[22px] bg-[rgba(248,252,255,0.88)] px-4 py-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]/42">{label}</p>
      <p className={`mt-2 text-sm font-black text-[var(--foreground)] ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  disabled: boolean;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const { label, value, disabled, options, onChange } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="dream-input w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, step, disabled, onChange } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="dream-input w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}
