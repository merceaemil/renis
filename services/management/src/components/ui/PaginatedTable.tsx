"use client";

import type { ReactNode } from "react";
import { Pagination, type PageSizeOption } from "@/components/ui/Pagination";

type PaginatedTableProps = {
  children: ReactNode;
  page: number;
  pageSize: PageSizeOption;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
};

export function PaginatedTable({
  children,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginatedTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {children}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
