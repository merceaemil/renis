import { useCallback, useEffect, useState } from "react";
import type { VerifyResult } from "./types";

function VerifyResultView({ data }: { data: VerifyResult }) {
  if (data.status === "TRANSCRIPT") {
    return (
      <div className="renis-alert renis-alert--success">
        <strong>Valid academic transcript</strong>
        <dl className="renis-dl">
          <dt>Institution</dt>
          <dd>{data.institution ?? ""}</dd>
          <dt>Programme</dt>
          <dd>{data.programme ?? ""}</dd>
          <dt>Academic year</dt>
          <dd>
            {data.academicYear ?? ""} · {data.semester ?? ""}
          </dd>
          <dt>Holder</dt>
          <dd>{data.holder ?? ""}</dd>
        </dl>
      </div>
    );
  }

  if (data.status === "PUBLISHED") {
    return (
      <div className="renis-alert renis-alert--success">
        <strong>Valid diploma</strong>
        <dl className="renis-dl">
          <dt>Type</dt>
          <dd>
            {data.type ?? ""} — {data.title ?? ""}
          </dd>
          <dt>Institution</dt>
          <dd>{data.institution ?? ""}</dd>
          <dt>Year</dt>
          <dd>{data.graduationYear ?? ""}</dd>
          {data.honors ? (
            <>
              <dt>Honors</dt>
              <dd>{data.honors}</dd>
            </>
          ) : null}
          <dt>Holder</dt>
          <dd>{data.holder ?? ""}</dd>
        </dl>
      </div>
    );
  }

  if (data.status === "REVOKED") {
    return (
      <div className="renis-alert renis-alert--revoked">
        <strong>Diploma revoked</strong>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          This diploma has been revoked
          {data.revokedAt
            ? ` on ${new Date(data.revokedAt).toLocaleDateString("en-GB")}`
            : ""}
          .
        </p>
      </div>
    );
  }

  return (
    <div className="renis-alert renis-alert--unknown">
      <strong>Unknown code</strong>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        {data.message ??
          "No diploma matches this code. Please check your entry."}
      </p>
    </div>
  );
}

export interface VerifyWidgetProps {
  apiUrl: string;
  initialCode?: string;
}

export function VerifyWidget({ apiUrl, initialCode = "" }: VerifyWidgetProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch(
          `${apiUrl}/api/verify/${encodeURIComponent(trimmed)}`
        );
        setResult((await res.json()) as VerifyResult);
      } catch {
        setError("Connection error. Please try again later.");
      } finally {
        setLoading(false);
      }
    },
    [apiUrl]
  );

  useEffect(() => {
    if (initialCode.trim()) {
      void verify(initialCode);
    }
  }, [initialCode, verify]);

  return (
    <div className="renis-root">
      <div className="renis-card">
        <p className="renis-title">Diploma & transcript verification</p>
        <p className="renis-subtitle">RENIS-BI</p>

        <label className="renis-label" htmlFor="renis-code-input">
          Unique code or QR scan value
        </label>
        <input
          id="renis-code-input"
          type="text"
          className="renis-input"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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
          {loading ? "Verifying…" : "Verify"}
        </button>

        <div className="renis-result">
          {loading && (
            <p className="renis-result--loading">Verifying…</p>
          )}
          {error && <p className="renis-result--error">{error}</p>}
          {result && !loading && <VerifyResultView data={result} />}
        </div>
      </div>
    </div>
  );
}
