"use client";

import { useMemo } from "react";

import { buildVisiblePages } from "@/components/share/pagination-controls/helpers";
import type { PaginationControlsProps } from "@/components/share/pagination-controls/types";

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className = "",
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const visiblePages = useMemo(
    () => buildVisiblePages(safePage, totalPages),
    [safePage, totalPages],
  );

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 sm:justify-end ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(safePage - 1)}
        disabled={safePage <= 1}
        className="btn-subtle rounded-full px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-55"
      >
        上一页
      </button>

      {visiblePages.map((token, index) =>
        token === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-1 text-sm font-black text-[var(--foreground)]/50"
            aria-hidden="true"
          >
            ...
          </span>
        ) : (
          <button
            key={`page-${token}`}
            type="button"
            onClick={() => onPageChange(token)}
            className={`rounded-full px-3.5 py-2 text-sm font-black transition ${
              token === safePage ? "btn-primary" : "btn-subtle text-[var(--foreground)]/75"
            }`}
            aria-current={token === safePage ? "page" : undefined}
          >
            {token}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(safePage + 1)}
        disabled={safePage >= totalPages}
        className="btn-subtle rounded-full px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-55"
      >
        下一页
      </button>
    </div>
  );
}
