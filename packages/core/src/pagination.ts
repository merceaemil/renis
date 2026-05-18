export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultPageSize: PageSizeOption = DEFAULT_PAGE_SIZE
) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const raw = Number.parseInt(
    searchParams.get("pageSize") ?? String(defaultPageSize),
    10
  );
  const pageSize = PAGE_SIZE_OPTIONS.includes(raw as PageSizeOption)
    ? (raw as PageSizeOption)
    : defaultPageSize;
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function paginateArray<T>(
  items: T[],
  searchParams: URLSearchParams
): PaginatedResult<T> {
  const { page, pageSize, skip, take } = parsePaginationParams(searchParams);
  const slice = items.slice(skip, skip + take);
  return buildPaginatedResult(slice, items.length, page, pageSize);
}
