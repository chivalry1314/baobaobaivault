"use client";

import Link from "next/link";

type SystemBackLinkProps = {
  href: string;
  label: string;
};

export function SystemBackLink(props: SystemBackLinkProps) {
  const { href, label } = props;
  return (
    <Link
      href={href}
      className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(120,85,94,0.18)] bg-white/82 px-4 py-2 text-sm font-black text-[var(--foreground)]/78 transition-colors duration-200 hover:bg-[rgba(248,252,255,0.92)]"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
