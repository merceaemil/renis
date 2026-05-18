import type { PaginatedResult } from "@renis/core/pagination";

export function isPaginatedResult<T>(data: unknown): data is PaginatedResult<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as PaginatedResult<T>).items) &&
    "total" in data
  );
}

/** Normalize API list responses (paginated or legacy `?all=true` array). */
export function normalizeListResponse<T>(data: unknown): PaginatedResult<T> {
  if (isPaginatedResult<T>(data)) return data;
  if (Array.isArray(data)) {
    const total = data.length;
    return {
      items: data as T[],
      total,
      page: 1,
      pageSize: total || 10,
      totalPages: 1,
    };
  }
  throw new Error("Invalid list response");
}

export function paginationSearchParams(
  page: number,
  pageSize: number,
  extra?: Record<string, string>
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...extra,
  });
  return params.toString();
}

/** Build a list API URL with `page` and `pageSize` query params. */
export function listApiUrl(
  path: string,
  page: number,
  pageSize: number,
  extra?: Record<string, string | undefined>
) {
  const qs = paginationSearchParams(page, pageSize);
  const extraParams = new URLSearchParams();
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) extraParams.set(key, value);
  }
  const extraQs = extraParams.toString();
  const combined = extraQs ? `${qs}&${extraQs}` : qs;
  return path.includes("?") ? `${path}&${combined}` : `${path}?${combined}`;
}
