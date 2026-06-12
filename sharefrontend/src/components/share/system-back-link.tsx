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
      className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-[var(--outline)]/20 bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
