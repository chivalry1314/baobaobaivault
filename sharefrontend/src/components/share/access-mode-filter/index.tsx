import type { ShareCardAccessMode } from "@/lib/shared";

export type ShareAccessModeFilter = "all" | ShareCardAccessMode;

const ACCESS_MODE_OPTIONS: Array<{
  value: ShareAccessModeFilter;
  label: string;
  activeClassName: string;
}> = [
  {
    value: "all",
    label: "全部",
    activeClassName: "border-[var(--line-strong)] bg-[rgba(221,241,250,0.96)] text-[var(--primary)]",
  },
  {
    value: "free",
    label: "免费",
    activeClassName: "border-[#2d8d62] bg-[#e9fff2] text-[#11613f]",
  },
  {
    value: "paid",
    label: "付费",
    activeClassName: "border-[#d67a33] bg-[#fff1df] text-[#8d4708]",
  },
];

export function matchesAccessModeFilter(mode: ShareCardAccessMode, filter: ShareAccessModeFilter) {
  return filter === "all" || mode === filter;
}

export function AccessModeFilterPills(props: {
  value: ShareAccessModeFilter;
  onChange: (value: ShareAccessModeFilter) => void;
  className?: string;
}) {
  const { value, onChange, className = "" } = props;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {ACCESS_MODE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border-[3px] px-4 py-2 text-sm font-black transition ${
              active
                ? option.activeClassName
                : "border-[var(--line-strong)] bg-white text-[var(--foreground)]/68 hover:-translate-y-0.5 hover:bg-[#f8fbff]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
