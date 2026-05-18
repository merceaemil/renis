"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PAGE_SIZE,
  type PageSizeOption,
  type PaginatedResult,
} from "@renis/core/pagination";
export function usePaginatedList<T>(
  fetchPage: (
    page: number,
    pageSize: PageSizeOption
  ) => Promise<PaginatedResult<T>>,
  resetDeps: unknown[] = []
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPage(page, pageSize);
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, page, pageSize]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, ...resetDeps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    loading,
    error,
    setError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    reload,
  };
}
