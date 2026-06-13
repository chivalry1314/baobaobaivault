import Link from "next/link";
import type { ReactNode } from "react";

import {
  expireOptions,
  getDisplayName,
  getSubmitButtonLabel,
  getUsageHelperText,
} from "@/components/share/card-access-code/helpers";
import { ShareImage } from "@/components/share/share-image";
import type {
  CardAccessCodeConfig,
  CardDetailResponse,
  ShareCardAccessMode,
} from "@/lib/shared";

export function AccessCodeWizardSteps() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.2rem] border-2 border-[var(--outline)] bg-white px-4 py-3 shadow-sm">
      <StepPill
        active={false}
        label="STEP 01"
        title="选择卡片"
        icon={<HeartIcon className="h-4 w-4" />}
      />
      <div className="hidden h-px w-8 bg-[var(--outline)]/30 lg:block" />
      <StepPill
        active
        label="STEP 02"
        title="配置提取码"
        icon={<SettingsIcon className="h-4 w-4" />}
      />
    </div>
  );
}

export function AccessCodeHero(props: { backHref: string }) {
  const { backHref } = props;
  return (
    <div className="flex items-start gap-3">
      <Link
        href={backHref}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--outline)] bg-white text-[var(--foreground)]/75 shadow-sm transition hover:bg-[var(--surface-container)]"
      >
        <BackIcon className="h-5 w-5" />
      </Link>

      <div>
        <h1 className="text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl">
          卡片提取码设置
        </h1>
        <p className="mt-1 text-xs font-bold text-[var(--foreground)]/58 sm:text-sm">
          你可以把卡片设置为免费或需提取码，需提取码模式下可配置提取码规则。
        </p>
      </div>
    </div>
  );
}

export function AccessCodeLoadingSkeleton() {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="h-[420px] animate-pulse rounded-[1.4rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]" />
      <div className="h-[540px] animate-pulse rounded-[1.4rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]" />
    </div>
  );
}

export function AccessCodeError(props: { message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-4xl rounded-[28px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-4 text-sm text-[#9a3412]">
      {props.message}
    </div>
  );
}

export function AccessCodeCardPreview(props: { detail: CardDetailResponse }) {
  const { detail } = props;
  return (
    <section className="h-fit rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-sm font-black text-[var(--foreground)]">
        <CardIcon className="h-4 w-4 text-[var(--primary)]" />
        <span>目标卡片</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]">
        {detail.card.mimeType.startsWith("image/") ? (
          <ShareImage
            src={detail.card.previewUrl}
            alt={detail.card.title}
            className="aspect-[3/2] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/2] w-full items-center justify-center px-4 text-center text-sm font-medium text-[var(--foreground)]/72">
            {detail.card.title}
          </div>
        )}

        <div className="border-t border-[var(--outline)]/10 p-3">
          <h2 className="line-clamp-2 text-sm font-black leading-tight text-[var(--foreground)]">
            {detail.card.title}
          </h2>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-[var(--foreground)]/58">
            <span className="inline-flex items-center gap-1">
              <DownloadMiniIcon className="h-3 w-3" />
              {detail.stats.downloadCount}
            </span>
            <span className="truncate">@{detail.creator.username || getDisplayName(detail.creator)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AccessCodeFormPanel(props: {
  accessMode: ShareCardAccessMode;
  setAccessMode: (mode: ShareCardAccessMode) => void;
  code: string;
  setCode: (value: string) => void;
  setCodeRandom: () => void;
  expireDays: number;
  setExpireDays: (value: number) => void;
  unlimited: boolean;
  setUnlimited: (updater: (current: boolean) => boolean) => void;
  usageLimit: string;
  setUsageLimit: (value: string) => void;
  config: CardAccessCodeConfig | null;
  success: string;
  pending: boolean;
  onSubmit: () => void;
}) {
  const {
    accessMode,
    setAccessMode,
    code,
    setCode,
    setCodeRandom,
    expireDays,
    setExpireDays,
    unlimited,
    setUnlimited,
    usageLimit,
    setUsageLimit,
    config,
    success,
    pending,
    onSubmit,
  } = props;

  const usageText = getUsageHelperText(config);
  const isPaid = accessMode === "paid";

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      {success ? (
        <div className="rounded-xl border border-[#b5dfc8] bg-[#f0fff4] px-3 py-2 text-xs font-black text-[#166534]">
          {success}
        </div>
      ) : null}

      <div className={success ? "mt-4" : ""}>
        <label className="block text-sm font-black text-[var(--foreground)]">
          卡片状态<span className="text-[var(--brand-strong)]">*</span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <AccessModeOption active={accessMode === "free"} onClick={() => setAccessMode("free")}>
            免费（无需提取码）
          </AccessModeOption>
          <AccessModeOption active={accessMode === "paid"} onClick={() => setAccessMode("paid")}>
            需提取码
          </AccessModeOption>
        </div>
      </div>

      <div
        className={`transition ${
          isPaid ? "opacity-100" : "pointer-events-none opacity-45"
        }`}
      >
        <div className="mt-5 border-t border-dashed border-[var(--outline)]/20" />

        <div className="mt-5">
          <label className="block text-sm font-black text-[var(--foreground)]">
            提取码<span className="text-[var(--brand-strong)]">*</span>
          </label>

          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/40" />
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white py-2.5 pl-9 pr-3 text-sm font-black tracking-[0.12em] text-[var(--foreground)] placeholder:text-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15 disabled:cursor-not-allowed disabled:bg-white/70"
                placeholder="例如 ABC-9KD-7QX"
                disabled={!isPaid}
              />
            </div>

            <button
              type="button"
              onClick={setCodeRandom}
              disabled={!isPaid}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--outline)]/20 bg-white px-4 py-2.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              <span>随机生成</span>
            </button>
          </div>

          <p className="mt-2 text-[10px] font-bold text-[var(--foreground)]/50">
            建议使用字母和数字组合，便于手动输入与分享。
          </p>
        </div>

        <div className="mt-5 border-t border-dashed border-[var(--outline)]/20" />

        <div className="mt-5">
          <h3 className="text-sm font-black text-[var(--foreground)]">有效期</h3>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {expireOptions.map((option) => {
              const active = option.value === expireDays;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpireDays(option.value)}
                  disabled={!isPaid}
                  className={`relative rounded-xl border-2 px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)]/8"
                      : "border-[var(--outline)]/20 bg-white hover:border-[var(--outline)]/40"
                  }`}
                >
                  <div className={`text-sm font-black ${active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/78"}`}>
                    {option.label}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-[var(--foreground)]">使用次数上限</h3>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--foreground)]/68">
              <span>不限次数</span>
              <button
                type="button"
                onClick={() => setUnlimited((current) => !current)}
                disabled={!isPaid}
                className={`relative h-6 w-11 rounded-full border-2 border-[var(--outline)] transition ${
                  unlimited ? "bg-[var(--primary)]" : "bg-[var(--surface-container-high)]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={unlimited}
              >
                <span
                  className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition ${
                    unlimited ? "left-[calc(100%-1.25rem-0.125rem)]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="relative mt-2.5">
            <PeopleIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/40" />
            <input
              type="number"
              min={1}
              disabled={!isPaid || unlimited}
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
              className="w-full rounded-xl border-2 border-[var(--outline)]/30 bg-white py-2.5 pl-9 pr-10 text-sm font-black text-[var(--foreground)] placeholder:text-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15 disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-[var(--foreground)]/40"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--foreground)]/50">
              次
            </span>
          </div>

          {usageText ? (
            <p className="mt-2 text-[10px] font-bold text-[var(--foreground)]/55">
              {usageText}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t border-dashed border-[var(--outline)]/20" />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="inline-flex min-w-[10rem] items-center justify-center gap-1.5 rounded-full bg-[var(--button-primary)] px-6 py-2.5 text-sm font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{getSubmitButtonLabel(pending)}</span>
          <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function AccessModeOption(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  const { active, onClick, children } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-2 text-xs font-black transition ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/8 text-[var(--foreground)]"
          : "border-[var(--outline)]/25 bg-white text-[var(--foreground)]/72 hover:border-[var(--outline)]/50"
      }`}
    >
      {children}
    </button>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75v10.5A2.25 2.25 0 0 1 19.5 19.5h-15A2.25 2.25 0 0 1 2.25 17.25V6.75A2.25 2.25 0 0 1 4.5 4.5Zm0 1.5a.75.75 0 0 0-.75.75v10.5c0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75V6.75A.75.75 0 0 0 19.5 6h-15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z"
        fill="currentColor"
      />
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
      <path
        d="m9.55 16.2-3.75-3.75 1.06-1.06 2.69 2.69 7.59-7.58 1.06 1.06-8.65 8.64Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadMiniIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 4.5h1.5v8.19l2.97-2.97 1.06 1.06L12 15.56l-4.78-4.78 1.06-1.06 2.97 2.97V4.5ZM5.25 17.25h13.5v1.5H5.25v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function KeyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M15.72 2.22a4.46 4.46 0 0 1 5.97 5.97l-.36.36a4.46 4.46 0 0 1-5.97 0l-7.85 7.85a3.001 3.001 0 1 1-1.06-1.06l7.85-7.85a4.46 4.46 0 0 1 1.42-5.27Zm2.12 2.12a2.21 2.21 0 0 0-2.83.26 2.21 2.21 0 0 0 .26 3.31l.35.35.47-.47a1.125 1.125 0 1 1 1.59 1.59l-.47.47.35.35a2.21 2.21 0 0 0 3.31.26 2.21 2.21 0 0 0 .26-3.31l-1.29-2.81Zm-12.3 13.3a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z"
        fill="currentColor"
      />
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

function StepPill(props: {
  active: boolean;
  label: string;
  title: string;
  icon: ReactNode;
}) {
  const { active, label, title, icon } = props;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[var(--brand-strong)] ${
          active
            ? "border-[var(--brand)]/30 bg-[var(--brand)]/10"
            : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/45"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--foreground)]/45">
          {label}
        </div>
        <div
          className={`text-xs font-black ${
            active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/50"
          }`}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
