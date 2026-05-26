import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale } from "@/lib/i18n";

function currentLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {}
  return DEFAULT_LOCALE;
}

/** Same-origin REST calls (management app hosts `/api/*`). */
export async function apiFetch(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  const url = path.startsWith("/") ? path : `/${path}`;
  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": currentLocale(),
      ...(headers as Record<string, string>),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}
