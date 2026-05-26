"use client";

import { useT } from "@/lib/i18n/LocaleProvider";

export function VerifySearchForm() {
  const t = useT();
  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 text-center mb-1">
        {t("verify.form.title")}
      </h2>
      <p className="text-sm text-slate-600 text-center mb-6">
        {t("verify.form.intro")}
      </p>
      <form action="/verify" method="get" className="space-y-4">
        <label className="block text-sm">
          <span className="text-slate-600">{t("verify.form.label")}</span>
          <input
            name="code"
            required
            autoComplete="off"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono focus:border-renis-primary focus:outline-none focus:ring-2 focus:ring-renis-primary/20"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-renis-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          {t("verify.form.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        {t("verify.form.hint")}
      </p>
    </>
  );
}
