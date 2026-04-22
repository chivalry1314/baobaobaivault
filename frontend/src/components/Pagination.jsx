import { useMemo } from "react";
import * as Icons from "lucide-react";

const PAGE_SIZE = 10;

export { PAGE_SIZE };

export default function Pagination({ total, page, pageSize = PAGE_SIZE, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pages = useMemo(() => {
    const items = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      let start = Math.max(2, safePage - 1);
      let end = Math.min(totalPages - 1, safePage + 1);
      if (safePage <= 3) {
        end = Math.min(4, totalPages - 1);
      }
      if (safePage >= totalPages - 2) {
        start = Math.max(totalPages - 3, 2);
      }
      if (start > 2) items.push("...");
      for (let i = start; i <= end; i++) items.push(i);
      if (end < totalPages - 1) items.push("...");
      items.push(totalPages);
    }

    return items;
  }, [safePage, totalPages]);

  if (total <= 0) return null;

  return (
    <div className="pagination">
      <button type="button" disabled={safePage <= 1} onClick={() => onChange(safePage - 1)}>
        <Icons.ChevronLeft size={16} />
      </button>
      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className="pagination-info">...</span>
        ) : (
          <button key={p} type="button" className={p === safePage ? "active" : ""} onClick={() => onChange(p)}>
            {p}
          </button>
        )
      )}
      <button type="button" disabled={safePage >= totalPages} onClick={() => onChange(safePage + 1)}>
        <Icons.ChevronRight size={16} />
      </button>
      <span className="pagination-info">
        共 {total} 条
      </span>
    </div>
  );
}
