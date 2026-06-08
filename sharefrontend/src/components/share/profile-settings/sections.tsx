import type { ReactNode } from "react";

function SparklesIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 2 1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Zm7 9 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4ZM6 14l1.2 2.8L10 18l-2.8 1.2L6 22l-1.2-2.8L2 18l2.8-1.2L6 14Z"
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

function LandscapeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4.5 5.25h15A2.25 2.25 0 0 1 21.75 7.5v9A2.25 2.25 0 0 1 19.5 18.75h-15A2.25 2.25 0 0 1 2.25 16.5v-9A2.25 2.25 0 0 1 4.5 5.25Zm0 1.5a.75.75 0 0 0-.75.75v9c0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75h-15Zm2.9 8.9 2.9-3.53a.75.75 0 0 1 1.16.02l2.15 2.67 1.58-1.78a.75.75 0 0 1 1.13.01l2.18 2.61v.6H5.52l1.88-.6Zm2.1-5.03a1.13 1.13 0 1 0 0-2.25 1.13 1.13 0 0 0 0 2.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25h-.75A2.25 2.25 0 0 0 4.5 10.5v9A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-.75V6A4.5 4.5 0 0 0 12 1.5Zm-3 6.75V6a3 3 0 1 1 6 0v2.25H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V16.5h-1.5v-2.45a1.5 1.5 0 0 1 .75-2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function KeyIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M8.25 10.5a4.5 4.5 0 1 1 3.72 4.43l-1.47 1.47h-1.75v1.75H7v1.75H4.5v-3.22l4.1-4.1A4.47 4.47 0 0 1 8.25 10.5Zm4.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PhoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M8.25 2.25h7.5A2.25 2.25 0 0 1 18 4.5v15a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 6 19.5v-15a2.25 2.25 0 0 1 2.25-2.25Zm0 1.5a.75.75 0 0 0-.75.75v15c0 .41.34.75.75.75h7.5a.75.75 0 0 0 .75-.75v-15a.75.75 0 0 0-.75-.75h-7.5Zm2.25 13.5h3v1.5h-3v-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m6.53 5.47 5.47 5.47 5.47-5.47 1.06 1.06L13.06 12l5.47 5.47-1.06 1.06L12 13.06l-5.47 5.47-1.06-1.06L10.94 12 5.47 6.53l1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-[1.12rem] text-[var(--foreground)]">
      <span className="text-[var(--primary)]">{icon}</span>
      <span className="font-black">{children}</span>
    </div>
  );
}

export function SecurityRow({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
  muted = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className={`dream-chip flex h-14 w-14 items-center justify-center ${
            muted
              ? "bg-[#f6d4e4] text-[var(--brand-strong)]"
              : "bg-[var(--button-primary)] text-[var(--foreground)]"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[1.1rem] font-black text-[var(--foreground)]">
            {title}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="btn-subtle self-end rounded-full px-5 py-2.5 text-sm font-black text-[var(--foreground)]/76 sm:self-auto"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export function ModalCard({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,24,27,0.18)] p-4 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="关闭弹窗"
        onClick={onClose}
      />
      <div className="dream-panel relative z-10 w-full max-w-[500px] p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-[var(--foreground)]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-subtle flex h-11 w-11 items-center justify-center rounded-full text-[var(--foreground)]/62"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export const ProfileSettingsIcons = {
  SparklesIcon,
  HeartIcon,
  LandscapeIcon,
  LockIcon,
  KeyIcon,
  PhoneIcon,
} as const;
