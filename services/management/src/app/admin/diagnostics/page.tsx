"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { AuditActionBadge } from "@/components/ui/AuditActionBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiFetch } from "@/lib/api";
import type {
  ConfigCheck,
  DiagnosticsPayload,
} from "@/lib/system-diagnostics";

function HealthCard({
  title,
  ok,
  subtitle,
  children,
}: {
  title: string;
  ok: boolean | null;
  subtitle?: string;
  children?: ReactNode;
}) {
  const tone =
    ok === null
      ? "border-slate-200"
      : ok
        ? "border-emerald-200 bg-emerald-50/50"
        : "border-red-200 bg-red-50/50";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-slate-900">{title}</h3>
        {ok !== null ? (
          <StatusBadge
            status={ok ? "ACTIVE" : "REVOKED"}
            label={ok ? "OK" : "Issue"}
          />
        ) : (
          <StatusBadge status="INACTIVE" label="N/A" />
        )}
      </div>
      {subtitle ? <p className="text-xs text-slate-600 mb-2">{subtitle}</p> : null}
      {children}
    </div>
  );
}

function ConfigStatusBadge({ status }: { status: ConfigCheck["status"] }) {
  if (status === "ok") {
    return <StatusBadge status="ACTIVE" label="Set" />;
  }
  if (status === "missing") {
    return <StatusBadge status="REVOKED" label="Missing" />;
  }
  return <StatusBadge status="INACTIVE" label="Not set" />;
}

function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 hover:border-renis-primary/30 hover:bg-white transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">{inner}</div>
  );
}

function overallAlertVariant(
  overall: DiagnosticsPayload["overall"]
): "success" | "warning" | "error" {
  if (overall === "healthy") return "success";
  if (overall === "degraded") return "warning";
  return "error";
}

function overallMessage(overall: DiagnosticsPayload["overall"]) {
  if (overall === "healthy") return "All critical checks passed.";
  if (overall === "degraded") {
    return "System is running but some optional services or configuration need attention.";
  }
  return "Critical failure — database or core configuration is unavailable.";
}

export default function DiagnosticsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/diagnostics", {
        accessToken: session.accessToken,
      });
      if (!res.ok) throw new Error("Could not load diagnostics");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <AppShell title="System diagnostics">
      <PageHeader
        description="Super Admin health check: connectivity, configuration, data volumes, and recent activity."
        actions={
          <button
            type="button"
            className="renis-btn-secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}

      {loading && !data ? (
        <p className="text-slate-500 py-8">Loading diagnostics…</p>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Alert variant={overallAlertVariant(data.overall)}>
            <p className="font-medium capitalize">{data.overall} system status</p>
            <p className="mt-1">{overallMessage(data.overall)}</p>
            {data.issues.length > 0 ? (
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm">
                {data.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs opacity-80">
              Last checked {new Date(data.checkedAt).toLocaleString()} ·{" "}
              {data.environment} · v{data.version}
            </p>
          </Alert>

          <section className="grid gap-4 md:grid-cols-3">
            <HealthCard
              title="PostgreSQL"
              ok={data.database.ok}
              subtitle={
                data.database.latencyMs !== null
                  ? `Round-trip ${data.database.latencyMs} ms`
                  : undefined
              }
            >
              {data.database.error ? (
                <p className="text-xs text-red-800">{data.database.error}</p>
              ) : null}
            </HealthCard>

            <HealthCard
              title="Object storage (MinIO)"
              ok={data.storage.configured ? data.storage.ok : null}
              subtitle={
                data.storage.configured
                  ? `Bucket: ${data.storage.bucket}`
                  : "MINIO_ENDPOINT not configured"
              }
            >
              {data.storage.endpoint ? (
                <p className="font-mono text-[10px] text-slate-600 break-all">
                  {data.storage.endpoint}
                </p>
              ) : null}
              {data.storage.error ? (
                <p className="text-xs text-red-800 mt-1">{data.storage.error}</p>
              ) : null}
            </HealthCard>

            <HealthCard
              title="Keycloak OIDC"
              ok={data.keycloak.configured ? data.keycloak.ok : null}
              subtitle={data.keycloak.issuer ?? "Issuer not configured"}
            >
              {data.keycloak.error ? (
                <p className="text-xs text-red-800">{data.keycloak.error}</p>
              ) : null}
            </HealthCard>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Configuration</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Variable</th>
                    <th className="py-2 pr-4 font-medium">Value</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.config.map((row) => (
                    <tr key={row.key} className="border-t border-slate-50">
                      <td className="py-2 pr-4">
                        <p className="font-mono text-xs text-slate-800">{row.key}</p>
                        <p className="text-slate-600 text-xs">{row.label}</p>
                        {row.hint ? (
                          <p className="text-slate-400 text-[10px] mt-0.5">{row.hint}</p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs break-all text-slate-700">
                        {row.value ?? "—"}
                      </td>
                      <td className="py-2">
                        <ConfigStatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Data volumes</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile label="Institutions" value={data.counts.institutions} href="/admin/institutions" />
              <StatTile label="Active institutions" value={data.counts.institutionsActive} />
              <StatTile label="Users" value={data.counts.users} href="/admin/users" />
              <StatTile label="Students" value={data.counts.students} href="/institution/students" />
              <StatTile label="Programmes" value={data.counts.programmes} href="/institution/programmes" />
              <StatTile label="Subjects" value={data.counts.subjects} />
              <StatTile label="Grade sessions" value={data.counts.gradeSessions} href="/institution/grades" />
              <StatTile label="Grade cells" value={data.counts.grades} />
              <StatTile label="Diplomas" value={data.counts.diplomas} href="/institution/diplomas" />
              <StatTile label="Enrollments" value={data.counts.enrollments} />
              <StatTile label="Transcript codes" value={data.counts.transcriptRecords} />
              <StatTile label="Audit log entries" value={data.counts.auditLogs} href="/admin/audit" />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-medium text-slate-900 mb-3">Diplomas by status</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(data.breakdown.diplomasByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between gap-2 border-b border-slate-50 pb-2">
                    <dt>
                      <StatusBadge status={status} />
                    </dt>
                    <dd className="font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-medium text-slate-900 mb-3">Grade sessions by status</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(data.breakdown.gradeSessionsByStatus).map(
                  ([status, count]) => (
                    <div
                      key={status}
                      className="flex justify-between gap-2 border-b border-slate-50 pb-2"
                    >
                      <dt>
                        <StatusBadge status={status} />
                      </dt>
                      <dd className="font-semibold tabular-nums">{count}</dd>
                    </div>
                  )
                )}
              </dl>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Users by role</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm max-w-lg">
              {Object.entries(data.breakdown.usersByRole).map(([role, count]) => (
                <div key={role} className="flex justify-between gap-2">
                  <dt className="text-slate-600">{role.replace(/_/g, " ")}</dt>
                  <dd className="font-semibold tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Recent activity</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 mb-4">
              <div>
                <dt className="text-slate-500">Last audit event</dt>
                <dd className="text-slate-900 mt-0.5">
                  {data.activity.lastAuditAt
                    ? new Date(data.activity.lastAuditAt).toLocaleString()
                    : "—"}
                </dd>
                {data.activity.lastAuditAction ? (
                  <dd className="mt-1">
                    <AuditActionBadge action={data.activity.lastAuditAction} />
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-slate-500">Last submitted grade session</dt>
                <dd className="text-slate-900 mt-0.5">
                  {data.activity.lastSubmittedGradeSessionAt
                    ? new Date(data.activity.lastSubmittedGradeSessionAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Audit events (24 h)</dt>
                <dd className="text-lg font-semibold mt-0.5">{data.activity.auditLast24h}</dd>
              </div>
            </dl>
            {data.activity.topAuditActions.length > 0 ? (
              <>
                <p className="text-xs text-slate-500 mb-2">Top actions (all time)</p>
                <ul className="flex flex-wrap gap-2">
                  {data.activity.topAuditActions.map((a) => (
                    <li
                      key={a.action}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs"
                    >
                      <AuditActionBadge action={a.action} />
                      <span className="font-medium tabular-nums text-slate-700">
                        {a.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Public URLs & integrations</h2>
            <ul className="space-y-3 text-sm">
              {[
                { label: "Management app", url: data.services.managementPublicUrl },
                { label: "QR verify base", url: data.services.qrVerifyBaseUrl },
                { label: "Keycloak issuer", url: data.services.keycloakIssuer },
                { label: "Keycloak admin", url: data.services.keycloakAdminUrl },
                { label: "Verify widget", url: data.services.widgetPublicUrl },
                { label: "TYPO3 site", url: data.services.typo3BaseUrl },
                { label: "MinIO public", url: data.services.minioPublicUrl },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-2"
                >
                  <span className="text-slate-600 shrink-0">{item.label}</span>
                  <span className="font-mono text-xs text-slate-800 break-all text-right">
                    {item.url ?? "—"}
                  </span>
                  {item.url ? (
                    <span className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-renis-primary text-xs hover:underline"
                      >
                        Open ↗
                      </a>
                      <button
                        type="button"
                        className="text-slate-500 text-xs hover:underline"
                        onClick={() => void copyUrl(item.url!)}
                      >
                        Copy
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {data.services.smtpHost ? (
              <p className="mt-3 text-xs text-slate-500">
                SMTP: <span className="font-mono">{data.services.smtpHost}</span>
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
