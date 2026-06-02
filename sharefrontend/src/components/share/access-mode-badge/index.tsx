import type { ShareCardAccessMode } from "@/lib/shared";

export function AccessModeBadge(props: {
  mode: ShareCardAccessMode;
  compact?: boolean;
  className?: string;
}) {
  const { mode, compact = false, className = "" } = props;

  const isPaid = mode === "paid";
  const label = isPaid ? (compact ? "需提取码" : "付费 · 需提取码") : "免费";
  const toneClass = isPaid
    ? "border-[#d67a33] bg-[#fff1df] text-[#8d4708]"
    : "border-[#2d8d62] bg-[#e9fff2] text-[#11613f]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-[3px] px-3 py-1 text-xs font-black ${toneClass} ${className}`.trim()}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${isPaid ? "bg-[#f59e0b]" : "bg-[#2fbf71]"}`}
      />
      <span>{label}</span>
    </span>
  );
}

