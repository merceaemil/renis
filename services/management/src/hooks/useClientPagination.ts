"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PAGE_SIZE,
  type PageSizeOption,
} from "@renis/core/pagination";

export function useClientPagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when filter/list changes
  }, [pageSize, total, ...resetDeps]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    pageItems,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
  };
}
