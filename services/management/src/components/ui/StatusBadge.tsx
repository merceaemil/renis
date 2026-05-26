"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

const variants: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  SUBMITTED: "bg-sky-50 text-sky-800 ring-sky-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REVOKED: "bg-red-50 text-red-800 ring-red-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  S1: "bg-slate-100 text-slate-700 ring-slate-200",
  S2: "bg-slate-100 text-slate-700 ring-slate-200",
};

const KNOWN_STATUS_KEYS: Record<string, TranslationKey> = {
  DRAFT: "status.DRAFT",
  SUBMITTED: "status.SUBMITTED",
  PUBLISHED: "status.PUBLISHED",
  REVOKED: "status.REVOKED",
  ACTIVE: "status.ACTIVE",
  INACTIVE: "status.INACTIVE",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const t = useT();
  const style = variants[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  const translationKey = KNOWN_STATUS_KEYS[status];
  const display =
    label ?? (translationKey ? t(translationKey) : status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {display}
    </span>
  );
}
