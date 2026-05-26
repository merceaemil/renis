"use client";

import type { ReactNode } from "react";
import type { VerifyLookupResult } from "@/lib/verify-lookup";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n";

const dateLocale: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
};

function formatDate(
  value: Date | string | null | undefined,
  locale: Locale
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(dateLocale[locale], {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(7rem,34%)_1fr] gap-x-4 gap-y-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-slate-500 text-sm">{label}</dt>
      <dd className="text-slate-900 text-sm font-medium">{value}</dd>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "danger" | "neutral";
  children: ReactNode;
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    danger: "bg-red-50 text-red-800 ring-red-200",
    neutral: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function IconCircle({
  tone,
  children,
}: {
  tone: "success" | "danger" | "neutral";
  children: ReactNode;
}) {
  const bg = {
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-red-100 text-red-700",
    neutral: "bg-amber-100 text-amber-700",
  };
  return (
    <div
      className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${bg[tone]}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

export function VerifyResultCard({
  result,
  code,
}: {
  result: VerifyLookupResult;
  code?: string;
}) {
  const { locale, t } = useLocale();

  if (result.status === "TRANSCRIPT") {
    return (
      <article>
        <IconCircle tone="success">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </IconCircle>
        <div className="text-center mb-6">
          <StatusBadge tone="success">{t("verify.transcript.badge")}</StatusBadge>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            {t("verify.transcript.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("verify.transcript.subtitle")}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50/80 px-4">
          <Row label={t("verify.field.institution")} value={result.institution} />
          <Row label={t("verify.field.programme")} value={result.programme} />
          <Row
            label={t("verify.field.academicPeriod")}
            value={`${result.academicYear} · ${result.semester}`}
          />
          <Row label={t("verify.field.holder")} value={result.holder} />
          <Row
            label={t("verify.field.verifiedOn")}
            value={formatDate(result.verifiedAt, locale)}
          />
        </div>
        {code ? <CodeFooter code={code} label={t("verify.code", { code })} /> : null}
      </article>
    );
  }

  if (result.status === "PUBLISHED") {
    return (
      <article>
        <IconCircle tone="success">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </IconCircle>
        <div className="text-center mb-6">
          <StatusBadge tone="success">{t("verify.diploma.badge")}</StatusBadge>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">{result.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("verify.diploma.subtitle")}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50/80 px-4">
          <Row label={t("verify.field.type")} value={result.type} />
          {result.programme ? (
            <Row label={t("verify.field.programme")} value={result.programme} />
          ) : null}
          <Row label={t("verify.field.institution")} value={result.institution} />
          <Row
            label={t("verify.field.graduationYear")}
            value={String(result.graduationYear)}
          />
          {result.honors ? (
            <Row label={t("verify.field.honors")} value={result.honors} />
          ) : null}
          <Row label={t("verify.field.holder")} value={result.holder} />
          <Row
            label={t("verify.field.published")}
            value={formatDate(result.publishedAt, locale)}
          />
        </div>
        {code ? <CodeFooter code={code} label={t("verify.code", { code })} /> : null}
      </article>
    );
  }

  if (result.status === "REVOKED") {
    return (
      <article>
        <IconCircle tone="danger">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </IconCircle>
        <div className="text-center mb-4">
          <StatusBadge tone="danger">{t("verify.revoked.badge")}</StatusBadge>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            {t("verify.revoked.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("verify.revoked.body")}
            {result.revokedAt
              ? ` ${t("verify.revoked.on", {
                  date: formatDate(result.revokedAt, locale),
                })}`
              : null}
          </p>
        </div>
        {code ? <CodeFooter code={code} label={t("verify.code", { code })} /> : null}
      </article>
    );
  }

  return (
    <article>
      <IconCircle tone="neutral">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </IconCircle>
      <div className="text-center">
        <StatusBadge tone="neutral">{t("verify.unknown.badge")}</StatusBadge>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          {t("verify.unknown.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{result.message}</p>
      </div>
      {code ? <CodeFooter code={code} label={t("verify.code", { code })} /> : null}
    </article>
  );
}

function CodeFooter({ code, label }: { code: string; label: string }) {
  return (
    <p
      className="mt-6 text-center text-xs text-slate-400 font-mono break-all"
      data-code={code}
    >
      {label}
    </p>
  );
}
