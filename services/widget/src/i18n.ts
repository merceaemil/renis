/**
 * Widget i18n: small, framework-free dictionary so the embeddable bundle
 * stays tiny. The locale is read from the host element (`language` or
 * `data-language`/`lang` attribute) and falls back to `document.documentElement.lang`,
 * then to "en".
 */

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type WidgetLocale = (typeof SUPPORTED_LOCALES)[number];
/** Default to French — matches the platform-wide default. */
export const DEFAULT_LOCALE: WidgetLocale = "fr";

function isLocale(value: unknown): value is WidgetLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): WidgetLocale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const lower = value.trim().toLowerCase();
  if (!lower) return DEFAULT_LOCALE;
  if (isLocale(lower)) return lower;
  const primary = lower.split(/[-_]/)[0];
  if (isLocale(primary)) return primary;
  return DEFAULT_LOCALE;
}

export function detectLocaleFromElement(
  container: HTMLElement
): WidgetLocale {
  const attr =
    container.getAttribute("language") ??
    container.dataset.language ??
    container.getAttribute("lang") ??
    document.documentElement.lang;
  return normalizeLocale(attr);
}

type Messages = Record<string, string>;

const dictionaries: Record<WidgetLocale, Messages> = {
  en: {
    "widget.title": "Diploma & transcript verification",
    "widget.subtitle": "RENIS-BI",
    "widget.label": "Unique code or QR scan value",
    "widget.placeholder": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "widget.button.verify": "Verify",
    "widget.button.verifying": "Verifying…",
    "widget.loading": "Verifying…",
    "widget.error.connection": "Connection error. Please try again later.",

    "widget.result.transcript.title": "Valid academic transcript",
    "widget.result.diploma.title": "Valid diploma",
    "widget.result.revoked.title": "Diploma revoked",
    "widget.result.revoked.body":
      "This diploma has been revoked{date}.",
    "widget.result.revoked.dateSuffix": " on {date}",
    "widget.result.unknown.title": "Unknown code",
    "widget.result.unknown.body":
      "No diploma matches this code. Please check your entry.",

    "widget.field.institution": "Institution",
    "widget.field.programme": "Programme",
    "widget.field.academicYear": "Academic year",
    "widget.field.holder": "Holder",
    "widget.field.type": "Type",
    "widget.field.year": "Year",
    "widget.field.honors": "Honors",
  },
  fr: {
    "widget.title": "Vérification de diplômes et relevés",
    "widget.subtitle": "RENIS-BI",
    "widget.label": "Code unique ou valeur du QR code",
    "widget.placeholder": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "widget.button.verify": "Vérifier",
    "widget.button.verifying": "Vérification…",
    "widget.loading": "Vérification…",
    "widget.error.connection":
      "Erreur de connexion. Veuillez réessayer plus tard.",

    "widget.result.transcript.title": "Relevé académique valide",
    "widget.result.diploma.title": "Diplôme valide",
    "widget.result.revoked.title": "Diplôme révoqué",
    "widget.result.revoked.body": "Ce diplôme a été révoqué{date}.",
    "widget.result.revoked.dateSuffix": " le {date}",
    "widget.result.unknown.title": "Code inconnu",
    "widget.result.unknown.body":
      "Aucun diplôme ne correspond à ce code. Veuillez vérifier votre saisie.",

    "widget.field.institution": "Institution",
    "widget.field.programme": "Programme",
    "widget.field.academicYear": "Année académique",
    "widget.field.holder": "Titulaire",
    "widget.field.type": "Type",
    "widget.field.year": "Année",
    "widget.field.honors": "Mentions",
  },
};

export function createTranslator(locale: WidgetLocale) {
  return function t(
    key: string,
    vars?: Record<string, string | number>
  ): string {
    const localeMsg = dictionaries[locale]?.[key];
    const fallback = dictionaries[DEFAULT_LOCALE]?.[key];
    const template = localeMsg ?? fallback ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = vars[name];
      return v === undefined || v === null ? "" : String(v);
    });
  };
}

export const dateLocale: Record<WidgetLocale, string> = {
  en: "en-GB",
  fr: "fr-FR",
};
