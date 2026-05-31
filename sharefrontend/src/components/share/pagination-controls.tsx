"use client";

import { useMemo } from "react";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
};

const PAGE_WINDOW = 1;

function buildVisiblePages(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - PAGE_WINDOW);
  const end = Math.min(totalPages - 1, page + PAGE_WINDOW);

  if (start > 2) {
    pages.push("ellipsis");
  }

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

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
    <div
      className={`flex flex-wrap items-center justify-center gap-2 sm:justify-end ${className}`}
    >
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
              token === safePage
                ? "btn-primary"
                : "btn-subtle text-[var(--foreground)]/75"
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
