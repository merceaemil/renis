import { useCallback, useEffect, useMemo, useState } from "react";
import type { VerifyResult } from "./types";
import {
  createTranslator,
  dateLocale,
  type WidgetLocale,
} from "./i18n";

type T = ReturnType<typeof createTranslator>;

function VerifyResultView({
  data,
  locale,
  t,
}: {
  data: VerifyResult;
  locale: WidgetLocale;
  t: T;
}) {
  if (data.status === "TRANSCRIPT") {
    return (
      <div className="renis-alert renis-alert--success">
        <strong>{t("widget.result.transcript.title")}</strong>
        <dl className="renis-dl">
          <dt>{t("widget.field.institution")}</dt>
          <dd>{data.institution ?? ""}</dd>
          <dt>{t("widget.field.programme")}</dt>
          <dd>{data.programme ?? ""}</dd>
          <dt>{t("widget.field.academicYear")}</dt>
          <dd>
            {data.academicYear ?? ""} · {data.semester ?? ""}
          </dd>
          <dt>{t("widget.field.holder")}</dt>
          <dd>{data.holder ?? ""}</dd>
        </dl>
      </div>
    );
  }

  if (data.status === "PUBLISHED") {
    return (
      <div className="renis-alert renis-alert--success">
        <strong>{t("widget.result.diploma.title")}</strong>
        <dl className="renis-dl">
          <dt>{t("widget.field.type")}</dt>
          <dd>
            {data.type ?? ""} — {data.title ?? ""}
          </dd>
          <dt>{t("widget.field.institution")}</dt>
          <dd>{data.institution ?? ""}</dd>
          <dt>{t("widget.field.year")}</dt>
          <dd>{data.graduationYear ?? ""}</dd>
          {data.honors ? (
            <>
              <dt>{t("widget.field.honors")}</dt>
              <dd>{data.honors}</dd>
            </>
          ) : null}
          <dt>{t("widget.field.holder")}</dt>
          <dd>{data.holder ?? ""}</dd>
        </dl>
      </div>
    );
  }

  if (data.status === "REVOKED") {
    const dateText = data.revokedAt
      ? t("widget.result.revoked.dateSuffix", {
          date: new Date(data.revokedAt).toLocaleDateString(dateLocale[locale]),
        })
      : "";
    return (
      <div className="renis-alert renis-alert--revoked">
        <strong>{t("widget.result.revoked.title")}</strong>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          {t("widget.result.revoked.body", { date: dateText })}
        </p>
      </div>
    );
  }

  return (
    <div className="renis-alert renis-alert--unknown">
      <strong>{t("widget.result.unknown.title")}</strong>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        {data.message ?? t("widget.result.unknown.body")}
      </p>
    </div>
  );
}

export interface VerifyWidgetProps {
  apiUrl: string;
  initialCode?: string;
  locale: WidgetLocale;
}

export function VerifyWidget({
  apiUrl,
  initialCode = "",
  locale,
}: VerifyWidgetProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const verify = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch(
          `${apiUrl}/api/verify/${encodeURIComponent(trimmed)}`,
          { headers: { "Accept-Language": locale } }
        );
        setResult((await res.json()) as VerifyResult);
      } catch {
        setError(t("widget.error.connection"));
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, locale, t]
  );

  useEffect(() => {
    if (initialCode.trim()) {
      void verify(initialCode);
    }
  }, [initialCode, verify]);

  return (
    <div className="renis-root" lang={locale}>
      <div className="renis-card">
        <p className="renis-title">{t("widget.title")}</p>
        <p className="renis-subtitle">{t("widget.subtitle")}</p>

        <label className="renis-label" htmlFor="renis-code-input">
          {t("widget.label")}
        </label>
        <input
          id="renis-code-input"
          type="text"
          className="renis-input"
          placeholder={t("widget.placeholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void verify(code);
          }}
          disabled={loading}
          autoComplete="off"
        />

        <button
          type="button"
          className="renis-btn"
          onClick={() => void verify(code)}
          disabled={loading}
        >
          {loading ? t("widget.button.verifying") : t("widget.button.verify")}
        </button>

        <div className="renis-result">
          {loading && (
            <p className="renis-result--loading">{t("widget.loading")}</p>
          )}
          {error && <p className="renis-result--error">{error}</p>}
          {result && !loading && (
            <VerifyResultView data={result} locale={locale} t={t} />
          )}
        </div>
      </div>
    </div>
  );
}
