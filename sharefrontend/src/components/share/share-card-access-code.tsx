"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardAccessCodeConfig, CardDetailResponse, ExternalSessionUser } from "@/lib/shared";

type ShareCardAccessCodeProps = {
  cardId: string;
};

const expireOptions = [
  { value: 1, label: "1 天", description: "短期时效分享" },
  { value: 7, label: "7 天", description: "推荐有效期" },
  { value: 0, label: "永久", description: "不限制到期时间" },
] as const;

function getDisplayName(user: ExternalSessionUser | CardDetailResponse["creator"]) {
  if ("email" in user) {
    const nickname = user.nickname.trim();
    if (nickname) {
      return nickname;
    }

    const username = user.username.trim();
    if (username) {
      return username;
    }

    return user.email.split("@")[0]?.trim() || "CardShare";
  }

  return user.nickname.trim() || user.username.trim() || "CardShare";
}

function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function chunk(length: number) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
  }

  return `${chunk(3)}-${chunk(3)}-${chunk(3)}`;
}

function getRarityLabel(downloadCount: number) {
  if (downloadCount >= 100) {
    return "UR";
  }
  if (downloadCount >= 20) {
    return "SR";
  }
  return "R";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN");
}

export function ShareCardAccessCode({ cardId }: ShareCardAccessCodeProps) {
  const searchParams = useSearchParams();
  const [sessionChecking, setSessionChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [detail, setDetail] = useState<CardDetailResponse | null>(null);
  const [config, setConfig] = useState<CardAccessCodeConfig | null>(null);

  const [code, setCode] = useState("");
  const [expireDays, setExpireDays] = useState<number>(7);
  const [unlimited, setUnlimited] = useState(false);
  const [usageLimit, setUsageLimit] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isWizardFlow = searchParams.get("flow") === "new-access-code";
  const backHref = "/creator/access-codes";
  const afterSuccessHref = isWizardFlow
    ? `/creator/cards/${encodeURIComponent(cardId)}/access-code?flow=new-access-code`
    : `/creator/cards/${encodeURIComponent(cardId)}/access-code`;

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        if (!session.authenticated || !session.user) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser(session.user);
      } catch {
        if (active) {
          setCurrentUser(null);
        }
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!currentUser) {
      return () => {
        active = false;
      };
    }

    async function loadData() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const [detailResponse, accessCodeResponse] = await Promise.all([shareApi.cardDetail(cardId), shareApi.cardAccessCode(cardId)]);
        if (!active) {
          return;
        }

        if (!detailResponse.canEdit) {
          setError("你没有该卡片的编辑权限，无法配置访问码。");
          setDetail(null);
          setConfig(null);
          return;
        }

        const nextConfig = accessCodeResponse.config;
        setDetail(detailResponse);
        setConfig(nextConfig);
        setCode(nextConfig.code || generateAccessCode());
        setExpireDays(nextConfig.code ? nextConfig.expireDays : 7);
        setUnlimited(nextConfig.code ? nextConfig.unlimited : false);
        setUsageLimit(nextConfig.code && nextConfig.usageLimit > 0 ? String(nextConfig.usageLimit) : "100");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getShareErrorMessage(loadError, "访问码配置加载失败，请稍后重试。"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [cardId, currentUser]);

  const footer = useMemo(
    () => (
      <footer className="relative z-10 px-6 pb-10 pt-12 text-center text-sm tracking-[0.08em] text-[color-mix(in_srgb,var(--brand)_28%,var(--foreground))]">
        © 2026 CardShare
      </footer>
    ),
    [],
  );

  async function handleSubmit() {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError("请输入访问码。");
      return;
    }

    if (!unlimited) {
      const numericLimit = Number(usageLimit);
      if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
        setError("使用次数上限必须是大于 0 的数字。");
        return;
      }
    }

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await shareApi.updateCardAccessCode(cardId, {
        code: normalizedCode,
        expireDays,
        usageLimit: unlimited ? 0 : Number(usageLimit),
        unlimited,
      });

      if (isWizardFlow && detail && (detail.card.visibility !== "public" || detail.card.status !== "published")) {
        const updateCardResponse = await shareApi.updateCard(cardId, {
          title: detail.card.title,
          description: detail.card.description,
          visibility: "public",
          status: "published",
        });

        setDetail((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            card: updateCardResponse.card,
          };
        });
      }

      const nextConfig = response.config;
      setConfig(nextConfig);
      setCode(nextConfig.code);
      setExpireDays(nextConfig.expireDays);
      setUnlimited(nextConfig.unlimited);
      setUsageLimit(nextConfig.usageLimit > 0 ? String(nextConfig.usageLimit) : usageLimit);
      setSuccess("访问码已保存。");
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "保存访问码失败，请重试。"));
    } finally {
      setPending(false);
    }
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          正在验证登录状态...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessHref} />;
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-8%] top-[14%] h-[24rem] w-[24rem] rounded-full bg-[rgba(203,234,249,0.34)] blur-[120px]" />
          <div className="absolute left-[18%] bottom-[8%] h-[24rem] w-[24rem] rounded-full bg-[rgba(248,219,230,0.22)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[var(--layout-max)] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
          {isWizardFlow ? (
            <div className="dream-panel-soft mb-8 flex flex-wrap items-center gap-4 px-5 py-4">
              <StepPill active={false} label="STEP 01" title="选择卡片" icon={<HeartIcon className="h-5 w-5" />} />
              <div className="hidden h-px w-12 bg-[rgba(190,216,228,0.9)] lg:block" />
              <StepPill active label="STEP 02" title="配置访问码" icon={<SettingsIcon className="h-5 w-5" />} />
            </div>
          ) : null}

          <div className="flex items-start gap-4">
            <Link href={backHref} className="btn-subtle inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
              <BackIcon className="h-6 w-6" />
            </Link>

            <div>
              <h1 className="mt-1 text-[2.2rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">卡片访问码设置</h1>
              <p className="mt-3 text-base text-[var(--foreground)]/62 sm:text-lg">设置有效期和次数上限，统一管理该卡片的分享权限。</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-10 grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="h-[620px] animate-pulse rounded-[38px] border border-white/80 bg-white/72" />
              <div className="h-[620px] animate-pulse rounded-[38px] border border-white/80 bg-white/72" />
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mx-auto mt-10 max-w-4xl rounded-[28px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-4 text-sm text-[#9a3412]">
              {error}
            </div>
          ) : null}

          {!loading && detail ? (
            <div className="mt-10 grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className="dream-panel p-6">
                <div className="flex items-center gap-3 text-[1.15rem] font-medium text-[var(--foreground)]">
                  <CardIcon className="h-6 w-6 text-[var(--primary)]" />
                  <span>目标卡片</span>
                </div>

                <div className="dream-panel-soft mt-6 rounded-[32px] bg-[#f8fcff] p-5">
                  <div className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#121826_0%,#1c2434_100%)]">
                    {detail.card.mimeType.startsWith("image/") ? (
                      <img src={detail.card.previewUrl} alt={detail.card.title} className="h-[476px] w-full object-cover" />
                    ) : (
                      <div className="flex h-[476px] items-center justify-center px-6 text-center text-2xl font-medium text-white/88">
                        {detail.card.title}
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(20,14,18,0)_0%,rgba(20,14,18,0.82)_100%)] px-6 pb-6 pt-20">
                      <div className="mb-4 inline-flex rounded-full bg-white/88 px-3 py-1 text-sm font-semibold text-[#f59e0b]">
                        {getRarityLabel(detail.stats.downloadCount)}
                      </div>
                      <h2 className="text-[1.9rem] font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">{detail.card.title}</h2>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-lg text-[var(--foreground)]/72">
                    <span>下载 {detail.stats.downloadCount} 次</span>
                    <span>作者 {detail.creator.username || getDisplayName(detail.creator)}</span>
                  </div>
                </div>
              </section>

              <section className="dream-panel p-8 sm:p-10">
                {success ? (
                  <div className="rounded-[22px] border border-[#b5dfc8] bg-[#f0fff4] px-4 py-3 text-sm text-[#166534]">{success}</div>
                ) : null}

                <div className={success ? "mt-6" : ""}>
                  <label className="block text-2xl font-medium text-[var(--foreground)]">
                    访问码<span className="text-[#d74b75]">*</span>
                  </label>

                  <div className="mt-5 flex flex-col gap-4 lg:flex-row">
                    <input
                      type="text"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      className="dream-input min-w-0 flex-1 px-7 py-5 text-[2rem] tracking-[0.16em] placeholder:text-[var(--foreground)]/28"
                      placeholder="例如 ABC-9KD-7QX"
                    />

                    <button
                      type="button"
                      onClick={() => setCode(generateAccessCode())}
                      className="btn-subtle inline-flex items-center justify-center gap-3 rounded-full px-7 py-5 text-xl font-black"
                    >
                      <RefreshIcon className="h-6 w-6" />
                      <span>随机生成</span>
                    </button>
                  </div>

                  <p className="mt-4 text-lg text-[var(--foreground)]/62">建议使用字母和数字组合，便于手动输入与分享。</p>
                </div>

                <div className="dream-divider mt-10 h-px border-t border-dashed" />

                <div className="mt-10">
                  <h3 className="text-[2rem] font-medium text-[var(--foreground)]">有效期</h3>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {expireOptions.map((option) => {
                      const active = option.value === expireDays;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setExpireDays(option.value)}
                          className={`relative rounded-[28px] border-[3px] px-6 py-6 text-center transition ${
                            active
                              ? "border-[var(--line-strong)] bg-[#eef8ff] shadow-[0_4px_0_rgba(46,40,86,0.2)]"
                              : "border-[rgba(46,40,86,0.26)] bg-white hover:border-[var(--line-strong)]"
                          }`}
                        >
                          {active ? <HeartMiniIcon className="absolute right-4 top-4 h-5 w-5 text-[var(--brand-strong)]" /> : null}
                          <div className="text-[2rem] font-semibold text-[var(--foreground)]">{option.label}</div>
                          <div className="mt-2 text-lg text-[var(--text-muted)]">{option.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-10">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[2rem] font-medium text-[var(--foreground)]">使用次数上限</h3>

                    <label className="inline-flex items-center gap-3 text-lg text-[var(--foreground)]/68">
                      <span>无限次数</span>
                      <button
                        type="button"
                        onClick={() => setUnlimited((current) => !current)}
                        className={`relative h-9 w-16 rounded-full border-[2px] border-[var(--line-strong)] transition ${
                          unlimited ? "bg-[#b3e4f6]" : "bg-[#e4ecf1]"
                        }`}
                        aria-pressed={unlimited}
                      >
                        <span
                          className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-[0_8px_16px_-12px_rgba(0,0,0,0.45)] transition ${
                            unlimited ? "left-8" : "left-1"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  <div className="relative mt-5">
                    <PeopleIcon className="pointer-events-none absolute left-6 top-1/2 h-7 w-7 -translate-y-1/2 text-[var(--foreground)]/36" />
                    <input
                      type="number"
                      min={1}
                      disabled={unlimited}
                      value={usageLimit}
                      onChange={(event) => setUsageLimit(event.target.value)}
                      className="dream-input w-full px-16 py-5 pr-16 text-[2rem] disabled:cursor-not-allowed disabled:bg-[#f8f3f5] disabled:text-[var(--foreground)]/36"
                    />
                    <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-[var(--text-muted)]">次</span>
                  </div>

                  {config?.isActive ? (
                    <p className="mt-4 text-base text-[var(--text-muted)]">
                      当前访问码已使用 {config.usageCount} 次。
                      {config.expiresAt ? ` 到期时间：${formatDateTime(config.expiresAt)}` : " 当前为永久有效。"}
                    </p>
                  ) : null}
                </div>

                <div className="dream-divider mt-10 h-px border-t border-dashed" />

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleSubmit()}
                    className="btn-primary inline-flex min-w-[320px] items-center justify-center gap-3 rounded-full px-8 py-6 text-[2rem] font-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{pending ? "保存中..." : "保存访问码设置"}</span>
                    <CheckIcon className="h-7 w-7" />
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75v10.5A2.25 2.25 0 0 1 19.5 19.5h-15A2.25 2.25 0 0 1 2.25 17.25V6.75A2.25 2.25 0 0 1 4.5 4.5Zm0 1.5a.75.75 0 0 0-.75.75v10.5c0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75V6.75A.75.75 0 0 0 19.5 6h-15Z" fill="currentColor" />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 4.5a7.5 7.5 0 0 1 6.84 4.42V6.75h1.5v5.25h-5.25V10.5h2.64A6 6 0 1 0 18 15h1.53A7.5 7.5 0 1 1 12 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PeopleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 10.5c2.76 0 5 1.79 5 4v1.5H1v-1.5c0-2.21 2.24-4 5-4Zm12 0c2.76 0 5 1.79 5 4v1.5H13v-1.5c0-2.21 2.24-4 5-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m9.55 16.2-3.75-3.75 1.06-1.06 2.69 2.69 7.59-7.58 1.06 1.06-8.65 8.64Z" fill="currentColor" />
    </svg>
  );
}

function HeartMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3.75 1.07 1.94 2.2.39 1.56-1.6 1.59 1.58-1.61 1.6.4 2.2 1.89 1.09-.63 2.18-2.18-.02-1.55 1.59.38 2.18-2.11.85-1.01-1.93-2.19-.01-1.02 1.93-2.1-.85.38-2.18-1.55-1.59-2.18.02-.63-2.18 1.89-1.09.4-2.2-1.61-1.6 1.59-1.58 1.56 1.6 2.2-.39L12 3.75Zm0 5.25A3 3 0 1 0 12 15a3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StepPill({
  active,
  label,
  title,
  icon,
}: {
  active: boolean;
  label: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border text-[var(--brand-strong)] shadow-[0_18px_36px_-30px_rgba(120,85,94,0.35)] ${
          active ? "border-[#e9a2b8] bg-[#ffe9f0]" : "border-white/85 bg-white/80 text-[var(--text-muted)]"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-subtle)]">{label}</div>
        <div className={`text-base font-medium ${active ? "text-[var(--foreground)]" : "text-[var(--text-subtle)]"}`}>{title}</div>
      </div>
    </div>
  );
}
