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
import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

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
  const t = useT();
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
            label={ok ? t("status.OK") : t("status.Issue")}
          />
        ) : (
          <StatusBadge status="INACTIVE" label={t("status.NA")} />
        )}
      </div>
      {subtitle ? <p className="text-xs text-slate-600 mb-2">{subtitle}</p> : null}
      {children}
    </div>
  );
}

function ConfigStatusBadge({ status }: { status: ConfigCheck["status"] }) {
  const t = useT();
  if (status === "ok") {
    return <StatusBadge status="ACTIVE" label={t("status.Set")} />;
  }
  if (status === "missing") {
    return <StatusBadge status="REVOKED" label={t("status.Missing")} />;
  }
  return <StatusBadge status="INACTIVE" label={t("status.NotSet")} />;
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

const overallMessageKey: Record<
  DiagnosticsPayload["overall"],
  TranslationKey
> = {
  healthy: "diagnostics.statusHealthy",
  degraded: "diagnostics.statusDegraded",
  unhealthy: "diagnostics.statusUnhealthy",
};

const overallLabelKey: Record<
  DiagnosticsPayload["overall"],
  TranslationKey
> = {
  healthy: "diagnostics.overall.healthy",
  degraded: "diagnostics.overall.degraded",
  unhealthy: "diagnostics.overall.unhealthy",
};

export default function DiagnosticsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
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
      if (!res.ok) throw new Error(t("diagnostics.couldNotLoad"));
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, t]);

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
    <AppShell title={t("diagnostics.title")}>
      <PageHeader
        description={t("diagnostics.description")}
        actions={
          <button
            type="button"
            className="renis-btn-secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? t("common.refreshing") : t("common.refresh")}
          </button>
        }
      />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}

      {loading && !data ? (
        <p className="text-slate-500 py-8">{t("diagnostics.loading")}</p>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Alert variant={overallAlertVariant(data.overall)}>
            <p className="font-medium">
              {t("diagnostics.systemStatus", {
                status: t(overallLabelKey[data.overall]),
              })}
            </p>
            <p className="mt-1">{t(overallMessageKey[data.overall])}</p>
            {data.issues.length > 0 ? (
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm">
                {data.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs opacity-80">
              {t("diagnostics.lastChecked", {
                when: new Date(data.checkedAt).toLocaleString(),
                environment: data.environment,
                version: data.version,
              })}
            </p>
          </Alert>

          <section className="grid gap-4 md:grid-cols-3">
            <HealthCard
              title={t("diagnostics.postgres")}
              ok={data.database.ok}
              subtitle={
                data.database.latencyMs !== null
                  ? t("diagnostics.roundTrip", { ms: data.database.latencyMs })
                  : undefined
              }
            >
              {data.database.error ? (
                <p className="text-xs text-red-800">{data.database.error}</p>
              ) : null}
            </HealthCard>

            <HealthCard
              title={t("diagnostics.storage")}
              ok={data.storage.configured ? data.storage.ok : null}
              subtitle={
                data.storage.configured
                  ? t("diagnostics.bucket", { bucket: data.storage.bucket })
                  : t("diagnostics.storageMissing")
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
              title={t("diagnostics.keycloak")}
              ok={data.keycloak.configured ? data.keycloak.ok : null}
              subtitle={
                data.keycloak.issuer ?? t("diagnostics.issuerMissing")
              }
            >
              {data.keycloak.error ? (
                <p className="text-xs text-red-800">{data.keycloak.error}</p>
              ) : null}
            </HealthCard>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">
              {t("diagnostics.configuration")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-4 font-medium">
                      {t("diagnostics.col.variable")}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t("diagnostics.col.value")}
                    </th>
                    <th className="py-2 font-medium">
                      {t("diagnostics.col.status")}
                    </th>
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
                        {row.value ?? t("common.dash")}
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
            <h2 className="font-medium text-slate-900 mb-3">
              {t("diagnostics.dataVolumes")}
            </h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile
                label={t("diagnostics.tile.institutions")}
                value={data.counts.institutions}
                href="/admin/institutions"
              />
              <StatTile
                label={t("diagnostics.tile.institutionsActive")}
                value={data.counts.institutionsActive}
              />
              <StatTile
                label={t("diagnostics.tile.users")}
                value={data.counts.users}
                href="/admin/users"
              />
              <StatTile
                label={t("diagnostics.tile.students")}
                value={data.counts.students}
                href="/institution/students"
              />
              <StatTile
                label={t("diagnostics.tile.programmes")}
                value={data.counts.programmes}
                href="/institution/programmes"
              />
              <StatTile
                label={t("diagnostics.tile.subjects")}
                value={data.counts.subjects}
              />
              <StatTile
                label={t("diagnostics.tile.gradeSessions")}
                value={data.counts.gradeSessions}
                href="/institution/grades"
              />
              <StatTile
                label={t("diagnostics.tile.gradeCells")}
                value={data.counts.grades}
              />
              <StatTile
                label={t("diagnostics.tile.diplomas")}
                value={data.counts.diplomas}
                href="/institution/diplomas"
              />
              <StatTile
                label={t("diagnostics.tile.enrollments")}
                value={data.counts.enrollments}
              />
              <StatTile
                label={t("diagnostics.tile.transcriptCodes")}
                value={data.counts.transcriptRecords}
              />
              <StatTile
                label={t("diagnostics.tile.auditLogs")}
                value={data.counts.auditLogs}
                href="/admin/audit"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-medium text-slate-900 mb-3">
                {t("diagnostics.diplomasByStatus")}
              </h2>
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
              <h2 className="font-medium text-slate-900 mb-3">
                {t("diagnostics.sessionsByStatus")}
              </h2>
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
            <h2 className="font-medium text-slate-900 mb-3">
              {t("diagnostics.usersByRole")}
            </h2>
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
            <h2 className="font-medium text-slate-900 mb-3">
              {t("diagnostics.recentActivity")}
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 mb-4">
              <div>
                <dt className="text-slate-500">
                  {t("diagnostics.lastAuditEvent")}
                </dt>
                <dd className="text-slate-900 mt-0.5">
                  {data.activity.lastAuditAt
                    ? new Date(data.activity.lastAuditAt).toLocaleString()
                    : t("common.dash")}
                </dd>
                {data.activity.lastAuditAction ? (
                  <dd className="mt-1">
                    <AuditActionBadge action={data.activity.lastAuditAction} />
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("diagnostics.lastSubmittedSession")}
                </dt>
                <dd className="text-slate-900 mt-0.5">
                  {data.activity.lastSubmittedGradeSessionAt
                    ? new Date(data.activity.lastSubmittedGradeSessionAt).toLocaleString()
                    : t("common.dash")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("diagnostics.auditLast24h")}
                </dt>
                <dd className="text-lg font-semibold mt-0.5">{data.activity.auditLast24h}</dd>
              </div>
            </dl>
            {data.activity.topAuditActions.length > 0 ? (
              <>
                <p className="text-xs text-slate-500 mb-2">
                  {t("diagnostics.topActions")}
                </p>
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
            <h2 className="font-medium text-slate-900 mb-3">
              {t("diagnostics.publicUrls")}
            </h2>
            <ul className="space-y-3 text-sm">
              {[
                { label: t("diagnostics.url.management"), url: data.services.managementPublicUrl },
                { label: t("diagnostics.url.qrVerify"), url: data.services.qrVerifyBaseUrl },
                { label: t("diagnostics.url.keycloakIssuer"), url: data.services.keycloakIssuer },
                { label: t("diagnostics.url.keycloakAdmin"), url: data.services.keycloakAdminUrl },
                { label: t("diagnostics.url.widget"), url: data.services.widgetPublicUrl },
                { label: t("diagnostics.url.typo3"), url: data.services.typo3BaseUrl },
                { label: t("diagnostics.url.minio"), url: data.services.minioPublicUrl },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-2"
                >
                  <span className="text-slate-600 shrink-0">{item.label}</span>
                  <span className="font-mono text-xs text-slate-800 break-all text-right">
                    {item.url ?? t("common.dash")}
                  </span>
                  {item.url ? (
                    <span className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-renis-primary text-xs hover:underline"
                      >
                        {t("common.open")}
                      </a>
                      <button
                        type="button"
                        className="text-slate-500 text-xs hover:underline"
                        onClick={() => void copyUrl(item.url!)}
                      >
                        {t("common.copy")}
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {data.services.smtpHost ? (
              <p className="mt-3 text-xs text-slate-500">
                {t("diagnostics.smtp")}:{" "}
                <span className="font-mono">{data.services.smtpHost}</span>
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
