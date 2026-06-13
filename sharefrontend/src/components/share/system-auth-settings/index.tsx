"use client";

import { useEffect, useState } from "react";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";
import { useToast } from "@/components/share/toast";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ShareAuthSettings, ShareEmailHealth } from "@/lib/shared";

export function ShareSystemAuthSettingsPage() {
  const { user, sessionChecking } = useShareSession();
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [authSettingsDraft, setAuthSettingsDraft] = useState<ShareAuthSettings | null>(null);
  const [authSettingsPending, setAuthSettingsPending] = useState(false);
  const [emailHealth, setEmailHealth] = useState<ShareEmailHealth | null>(null);
  const [smtpTestPending, setSMTPTestPending] = useState(false);
  const [smtpTestTargetEmail, setSMTPTestTargetEmail] = useState("");
  const [loading, setLoading] = useState(() => !!user?.isConfiguredSuperAdmin);
  const [loadError, setLoadError] = useState("");
  const showToast = useToast();

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
      setAuthSettingsDraft(authSettingsResponse.settings);
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "加载认证设置失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.isConfiguredSuperAdmin) {
      void loadData();
    }
  }, [user?.id, user?.isConfiguredSuperAdmin]);

  useEffect(() => {
    if (!user?.email) {
      setSMTPTestTargetEmail("");
      return;
    }
    setSMTPTestTargetEmail((current) => (current.trim() ? current : user.email));
  }, [user?.email]);

  function updateAuthSettingsDraft(patch: Partial<ShareAuthSettings>) {
    setAuthSettingsDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, ...patch };
    });
  }

  async function handleSaveAuthSettings() {
    if (!authSettingsDraft || authSettingsPending) {
      return;
    }

    setAuthSettingsPending(true);
    try {
      const response = await shareApi.updateSystemAuthSettings({
        emailVerificationEnabled: authSettingsDraft.emailVerificationEnabled,
        verificationCodeTTLSeconds: authSettingsDraft.verificationCodeTTLSeconds,
        resendIntervalSeconds: authSettingsDraft.resendIntervalSeconds,
        maxVerifyAttempts: authSettingsDraft.maxVerifyAttempts,
      });
      setAuthSettingsDraft(response.settings);
      setEmailVerificationEnabled(response.settings.emailVerificationEnabled);
      showToast("邮箱注册策略已保存。", "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "保存邮箱注册策略失败，请稍后重试。"), "error");
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
      showToast("请先填写测试收件邮箱", "error");
      return;
    }

    setSMTPTestPending(true);
    try {
      const response = await shareApi.sendSystemSMTPTestEmail({ targetEmail });
      showToast(`测试邮件已发送至 ${response.targetEmail}`, "success");
    } catch (error) {
      showToast(getShareErrorMessage(error, "测试邮件发送失败，请稍后重试。"), "error");
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
          <div className="border-b border-[var(--outline)]/20 pb-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${emailVerificationEnabled ? "bg-[#0f9d77]" : "bg-[#f0a33e]"}`} />
              <h2 className="text-base font-black text-[var(--foreground)]">邮箱验证状态</h2>
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--foreground)]/60">
              {emailVerificationEnabled
                ? "当前已开启邮箱验证码注册，新用户需要先完成邮箱验证后才能创建账号。"
                : "当前未开启邮箱验证码注册，新用户注册成功后会直接创建账号并登录。"}
            </p>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
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

          <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-[10px] font-bold leading-4 text-[var(--foreground)]/55">
            仅系统初始化超级管理员可修改。建议：有效期 300-1800 秒，重发间隔 30-300 秒，并且必须小于验证码有效期。
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveAuthSettings()}
              disabled={!authSettingsDraft?.canUpdate || authSettingsPending}
              className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authSettingsPending ? "保存中..." : "保存邮箱注册策略"}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-black text-[var(--foreground)]">测试发信</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--foreground)]/60">
              发送一封测试邮件，快速确认 SMTP 账户、网络和发件配置是否可用。
            </p>
            <label className="mt-2 block">
              <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">测试收件邮箱</span>
              <input
                type="email"
                value={smtpTestTargetEmail}
                onChange={(event) => setSMTPTestTargetEmail(event.target.value)}
                className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
                placeholder="请输入要接收测试邮件的邮箱"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSMTPTest()}
                disabled={smtpTestPending}
                className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {smtpTestPending ? "发送中..." : "发送 SMTP 测试邮件"}
              </button>
            </div>
          </section>

          <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-black text-[var(--foreground)]">SMTP 健康状态</h2>
            <div className="mt-2 grid gap-2">
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
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 text-sm font-bold text-[var(--foreground)]/70 shadow-sm">{text}</div>
    </SystemWorkspace>
  );
}

function SystemForbiddenPage({ currentPath }: { currentPath: string }) {
  return (
    <SystemWorkspace currentPath={currentPath} title="系统管理" description="当前账号不是系统初始化超级管理员，无法访问此页面。">
      <div className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-5 py-7 shadow-sm">
        <p className="text-sm font-bold leading-7 text-[var(--foreground)]/70">当前账号不是系统初始化超级管理员，无法访问此页面。</p>
      </div>
    </SystemWorkspace>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <p className="rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">{message}</p>;
}

function MetricCard(props: { label: string; value: string; breakAll?: boolean }) {
  const { label, value, breakAll = false } = props;
  return (
    <div className="rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/40">{label}</p>
      <p className={`mt-0.5 text-xs font-black text-[var(--foreground)] ${breakAll ? "break-all" : ""}`}>{value}</p>
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
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/65">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
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
      <span className="mb-1 block text-xs font-black text-[var(--foreground)]/65">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
      />
    </label>
  );
}
