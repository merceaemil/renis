"use client";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from "@renis/core/pagination";
import { useT } from "@/lib/i18n/LocaleProvider";

type PaginationProps = {
  page: number;
  pageSize: PageSizeOption;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  className?: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  className = "",
}: PaginationProps) {
  const t = useT();
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-sm ${className}`}
    >
      <p className="text-slate-600">
        {t("pagination.showing")}{" "}
        <span className="font-medium text-slate-900">{start}</span>–
        <span className="font-medium text-slate-900">{end}</span>{" "}
        {t("pagination.of")}{" "}
        <span className="font-medium text-slate-900">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-slate-600">
          <span className="text-xs">{t("pagination.perPage")}</span>
          <select
            className="renis-input py-1.5 w-auto min-w-[4.5rem]"
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as PageSizeOption)
            }
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="renis-btn-secondary px-2.5 py-1.5 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={t("pagination.previous")}
          >
            ←
          </button>
          <span className="min-w-[5rem] text-center text-slate-700 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="renis-btn-secondary px-2.5 py-1.5 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={t("pagination.next")}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption };
