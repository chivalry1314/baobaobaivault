"use client";

type LoadingSpinnerProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
};

const SIZE_MAP = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
};

export function LoadingSpinner({ label, size = "md", inline = false, className }: LoadingSpinnerProps) {
  return (
    <div
      className={`${inline ? "inline-flex flex-row" : "flex flex-col"} items-center justify-center gap-2 ${className ?? ""}`}
    >
      <div
        className={`animate-spin rounded-full border-[var(--outline)]/30 border-t-[var(--button-primary)] ${SIZE_MAP[size]}`}
      />
      {label ? (
        <span className="text-xs font-bold text-[var(--foreground)]/60">{label}</span>
      ) : null}
    </div>
  );
}
