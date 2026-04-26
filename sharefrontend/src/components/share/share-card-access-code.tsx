"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthCard } from "@/components/share/auth-card";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardAccessCodeConfig, CardDetailResponse, ExternalSessionUser } from "@/lib/shared";

type ShareCardAccessCodeProps = {
  cardId: string;
};

const expireOptions = [
  { value: 1, label: "1天", description: "短期活动" },
  { value: 7, label: "7天", description: "标准推荐" },
  { value: 0, label: "永久", description: "无时间限制" },
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
  const backHref = isWizardFlow ? "/creator/access-codes/new" : "/creator";
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
          setError("当前卡片暂不支持提取码管理。");
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

        setError(getShareErrorMessage(loadError, "提取码配置加载失败，请稍后再试。"));
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
      <footer className="relative z-10 px-6 pb-10 pt-12 text-center text-sm tracking-[0.08em] text-[var(--brand)]/55">
        © 2024 CardShare · 为每一份心意赋予分享价值
      </footer>
    ),
    [],
  );

  async function handleSubmit() {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError("请先填写提取码。");
      return;
    }

    if (!unlimited) {
      const numericLimit = Number(usageLimit);
      if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
        setError("请填写有效的使用次数。");
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

      const nextConfig = response.config;
      setConfig(nextConfig);
      setCode(nextConfig.code);
      setExpireDays(nextConfig.expireDays);
      setUnlimited(nextConfig.unlimited);
      setUsageLimit(nextConfig.usageLimit > 0 ? String(nextConfig.usageLimit) : usageLimit);
      setSuccess("提取码规则已保存。");
    } catch (submitError) {
      setError(getShareErrorMessage(submitError, "提取码保存失败，请稍后再试。"));
    } finally {
      setPending(false);
    }
  }

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          正在加载提取码管理...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <AuthCard afterSuccess={afterSuccessHref} />
      </div>
    );
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8f9_0%,#fff7f8_48%,#fff5f7_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[rgba(255,220,228,0.38)] blur-[120px]" />
          <div className="absolute right-[-8%] top-[14%] h-[24rem] w-[24rem] rounded-full bg-[rgba(243,220,255,0.34)] blur-[120px]" />
          <div className="absolute left-[18%] bottom-[8%] h-[24rem] w-[24rem] rounded-full bg-[rgba(255,235,240,0.3)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1460px] px-4 pb-16 pt-10 sm:px-6">
          {isWizardFlow ? (
            <div className="mb-8 flex flex-wrap items-center gap-4 rounded-[32px] border border-white/80 bg-white/76 px-5 py-4 shadow-[0_20px_40px_-34px_rgba(120,85,94,0.24)]">
              <StepPill active={false} label="STEP01" title="选择分享卡片" icon={<HeartIcon className="h-5 w-5" />} />
              <div className="hidden h-px w-12 bg-[rgba(223,198,206,0.9)] lg:block" />
              <StepPill active label="STEP02" title="配置提取规则" icon={<SettingsIcon className="h-5 w-5" />} />
            </div>
          ) : null}

          <div className="flex items-start gap-4">
            <Link
              href={backHref}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[rgba(241,193,207,0.78)] bg-white/82 text-[var(--foreground)] shadow-[0_16px_36px_-28px_rgba(120,85,94,0.35)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              <BackIcon className="h-6 w-6" />
            </Link>

            <div>
              <h1 className="mt-1 text-5xl font-semibold tracking-tight text-[var(--foreground)]">设置提取码</h1>
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
              <section className="rounded-[38px] border border-[rgba(241,193,207,0.72)] bg-[rgba(255,251,252,0.88)] p-6 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.28)]">
                <div className="flex items-center gap-3 text-[1.15rem] font-medium text-[var(--foreground)]">
                  <CardIcon className="h-6 w-6 text-[var(--primary)]" />
                  <span>目标卡片</span>
                </div>

                <div className="mt-6 rounded-[32px] bg-[linear-gradient(180deg,rgba(255,248,250,0.92),rgba(255,244,247,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
                        ★★★★★
                      </div>
                      <h2 className="text-4xl font-semibold tracking-tight text-white">{detail.card.title}</h2>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-lg text-[var(--foreground)]/72">
                    <span>稀有度：{getRarityLabel(detail.stats.downloadCount)}</span>
                    <span>画师：@{detail.creator.username || getDisplayName(detail.creator)}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-[38px] border border-[rgba(241,193,207,0.72)] bg-[rgba(255,251,252,0.88)] p-8 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.28)] sm:p-10">
                {success ? (
                  <div className="rounded-[22px] border border-[#b5dfc8] bg-[#f0fff4] px-4 py-3 text-sm text-[#166534]">{success}</div>
                ) : null}

                <div className={success ? "mt-6" : ""}>
                  <label className="block text-2xl font-medium text-[var(--foreground)]">
                    提取码 <span className="text-[#d74b75]">*</span>
                  </label>

                  <div className="mt-5 flex flex-col gap-4 lg:flex-row">
                    <input
                      type="text"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      className="min-w-0 flex-1 rounded-full border border-[rgba(210,185,191,0.78)] bg-white px-7 py-5 text-[2rem] tracking-[0.16em] text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground)]/28 focus:border-[var(--primary)]"
                      placeholder="*** SKR-992-AEX"
                    />

                    <button
                      type="button"
                      onClick={() => setCode(generateAccessCode())}
                      className="inline-flex items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#f4d8ff_0%,#efcaff_100%)] px-7 py-5 text-xl font-medium text-[var(--brand-strong)] shadow-[0_18px_36px_-28px_rgba(214,113,145,0.42)] transition hover:-translate-y-0.5"
                    >
                      <RefreshIcon className="h-6 w-6" />
                      <span>随机生成</span>
                    </button>
                  </div>

                  <p className="mt-4 text-lg text-[var(--foreground)]/62">用户将输入此代码来获取卡片。</p>
                </div>

                <div className="mt-10 h-px bg-[rgba(224,205,210,0.76)]" />

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
                          className={`relative rounded-[28px] border px-6 py-6 text-center transition ${
                            active
                              ? "border-[rgba(125,90,115,0.9)] bg-[rgba(255,240,244,0.9)] shadow-[0_18px_32px_-28px_rgba(125,90,115,0.42)]"
                              : "border-[rgba(220,195,201,0.88)] bg-white/84 hover:border-[rgba(125,90,115,0.56)]"
                          }`}
                        >
                          {active ? <HeartMiniIcon className="absolute right-4 top-4 h-5 w-5 text-[var(--brand-strong)]" /> : null}
                          <div className="text-[2rem] font-semibold text-[var(--foreground)]">{option.label}</div>
                          <div className="mt-2 text-lg text-[var(--foreground)]/58">{option.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-10">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[2rem] font-medium text-[var(--foreground)]">使用次数限制</h3>

                    <label className="inline-flex items-center gap-3 text-lg text-[var(--foreground)]/68">
                      <span>无限制</span>
                      <button
                        type="button"
                        onClick={() => setUnlimited((current) => !current)}
                        className={`relative h-9 w-16 rounded-full transition ${
                          unlimited ? "bg-[rgba(244,196,210,0.88)]" : "bg-[rgba(232,225,228,0.92)]"
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
                      className="w-full rounded-full border border-[rgba(210,185,191,0.78)] bg-white px-16 py-5 pr-16 text-[2rem] text-[var(--foreground)] outline-none transition disabled:cursor-not-allowed disabled:bg-[rgba(248,243,245,0.82)] disabled:text-[var(--foreground)]/36 focus:border-[var(--primary)]"
                    />
                    <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-[var(--foreground)]/58">次</span>
                  </div>

                  {config?.isActive ? (
                    <p className="mt-4 text-base text-[var(--foreground)]/58">
                      当前提取码已启用，已使用 {config.usageCount} 次。
                      {config.expiresAt ? ` 到期时间：${new Date(config.expiresAt).toLocaleString("zh-CN")}` : " 当前为永久有效。"}
                    </p>
                  ) : null}
                </div>

                <div className="mt-10 h-px bg-[rgba(224,205,210,0.76)]" />

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleSubmit()}
                    className="inline-flex min-w-[320px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#7d5a73_0%,#8d6780_100%)] px-8 py-6 text-[2rem] font-semibold text-white shadow-[0_24px_40px_-26px_rgba(125,90,115,0.82)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{pending ? "保存中..." : "确认并生成提取码"}</span>
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
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border text-[var(--brand-strong)] shadow-[0_18px_36px_-30px_rgba(120,85,94,0.35)] ${
          active ? "border-[#e9a2b8] bg-[#ffe9f0]" : "border-white/85 bg-white/80 text-[var(--foreground)]/48"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--foreground)]/42">{label}</div>
        <div className={`text-base font-medium ${active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/52"}`}>{title}</div>
      </div>
    </div>
  );
}
