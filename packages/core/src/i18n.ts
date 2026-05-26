/**
 * Shared i18n primitives for the RENIS-BI platform.
 *
 * The catalog here is intentionally minimal — it covers strings that the
 * server emits in API responses or directly rendered HTML so that the
 * management UI, the embeddable widget, and the public verify page can all
 * present API output in the user's chosen language.
 */

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
/**
 * Locale used when the user has not chosen one yet (no cookie / localStorage /
 * Accept-Language match) and as the missing-key fallback for `translate()`.
 * Catalogs are maintained in sync for every key, so French is safe as both.
 */
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const lower = value.trim().toLowerCase();
  if (!lower) return DEFAULT_LOCALE;
  if (isLocale(lower)) return lower;
  const primary = lower.split(/[-_]/)[0];
  if (isLocale(primary)) return primary;
  return DEFAULT_LOCALE;
}

/**
 * Picks the best-matching supported locale from an `Accept-Language` header
 * (RFC 7231). Falls back to `DEFAULT_LOCALE` when no match is found.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const parts = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((p) => p.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    if (isLocale(tag)) return tag;
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

type Messages = Record<string, string>;
export type Catalog = Record<Locale, Messages>;

/**
 * Looks up a translation, with English fallback when a key is missing in the
 * requested locale, and a `{var}` substitution for simple interpolation.
 */
export function translate(
  catalog: Catalog,
  key: string,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>
): string {
  const localeMsg = catalog[locale]?.[key];
  const fallback = catalog[DEFAULT_LOCALE]?.[key];
  const template = localeMsg ?? fallback ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}
