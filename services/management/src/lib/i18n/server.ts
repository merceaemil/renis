import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  LOCALE_COOKIE,
  parseAcceptLanguage,
  translate,
  type TranslationKey,
} from "./index";

/**
 * Server-side locale negotiation, in priority order:
 *
 *   1. Explicit `?lang=` query parameter (lets QR codes / direct links
 *      override the preferred language for a single response).
 *   2. The `renis-locale` cookie (persistent user choice).
 *   3. The `Accept-Language` header (best-effort browser preference).
 *   4. `DEFAULT_LOCALE`.
 */
export function resolveLocaleFromRequest(req: NextRequest): Locale {
  const queryLang = req.nextUrl.searchParams.get("lang");
  if (queryLang && isLocale(queryLang)) return queryLang;

  const cookieLang = req.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLang && isLocale(cookieLang)) return cookieLang;

  return parseAcceptLanguage(req.headers.get("accept-language"));
}

/**
 * Same logic as `resolveLocaleFromRequest`, but for Server Components and
 * server actions where only `next/headers` is available.
 */
export async function getServerLocale(
  searchParams?: { lang?: string | string[] }
): Promise<Locale> {
  const queryLang = searchParams?.lang;
  const candidate = Array.isArray(queryLang) ? queryLang[0] : queryLang;
  if (candidate && isLocale(candidate)) return candidate;

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLang && isLocale(cookieLang)) return cookieLang;

  const headerStore = await headers();
  return parseAcceptLanguage(headerStore.get("accept-language"));
}

export function serverT(
  locale: Locale = DEFAULT_LOCALE,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  return translate(key, locale, vars);
}
