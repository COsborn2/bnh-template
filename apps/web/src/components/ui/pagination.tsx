"use client";

import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

import { PAGE_SIZE } from "@/lib/pagination";

export { PAGE_SIZE };

interface PaginationProps {
  /** Zero-based page index. */
  page: number;
  /** Total rows matching the current filters, across all pages. */
  total: number;
  /** Noun for the summary line, e.g. "user" — pluralised with an "s". */
  itemLabel: string;
  onPageChange: (page: number) => void;
  pageSize?: number;
  /** Irregular plurals that "+s" gets wrong. */
  itemLabelPlural?: string;
}

/**
 * Offset pagination controls shared by the admin list screens: a
 * "Showing 1-20 of 63" summary plus Previous/Next.
 */
export function Pagination({
  page,
  total,
  itemLabel,
  onPageChange,
  pageSize = PAGE_SIZE,
  itemLabelPlural,
}: PaginationProps) {
  const offset = page * pageSize;
  const showingStart = total === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + pageSize, total);
  const label = total === 1 ? itemLabel : (itemLabelPlural ?? `${itemLabel}s`);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">
        Showing {showingStart}-{showingEnd} of {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="mr-1.5 h-3 w-3" />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={offset + pageSize >= total}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <FontAwesomeIcon icon={faChevronRight} className="ml-1.5 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
