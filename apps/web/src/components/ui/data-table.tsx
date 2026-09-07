"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Fired on pointer-enter / focus of a row — hook for prefetching the
   *  route a row navigates to before the click (see hooks/use-prefetch.ts). */
  onRowIntent?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  loadingRows = 5,
  emptyMessage = "No data found.",
  onRowClick,
  onRowIntent,
}: DataTableProps<T>) {
  return (
    // Scroll horizontally inside the card rather than clipping the right-hand
    // columns on narrow viewports (the parent must allow shrinking: min-w-0).
    <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-bg-raised">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-b-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : data.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-text-muted"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
              : data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onPointerEnter={
                    onRowIntent ? () => onRowIntent(row) : undefined
                  }
                  onFocus={onRowIntent ? () => onRowIntent(row) : undefined}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    onRowClick && "cursor-pointer hover:bg-bg-hover"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
