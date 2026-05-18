"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type Diagnostics = {
  version: string;
  environment: string;
  database: { ok: boolean };
  counts: Record<string, number>;
  services: Record<string, string | null>;
};

export default function DiagnosticsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      const res = await apiFetch("/api/admin/diagnostics", {
        accessToken: session.accessToken,
      });
      if (!res.ok) {
        setError("Could not load diagnostics");
        return;
      }
      setData(await res.json());
    })();
  }, [session?.accessToken]);

  return (
    <AppShell title="System diagnostics">
      <p className="mb-4 text-sm text-slate-600 max-w-2xl">
        Super Admin health check: database connectivity, entity counts, and
        configured public URLs (spec §2).
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6 text-sm">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p>
              <span className="text-slate-500">Environment:</span>{" "}
              <strong>{data.environment}</strong>
            </p>
            <p className="mt-1">
              <span className="text-slate-500">Database:</span>{" "}
              <strong className={data.database.ok ? "text-green-700" : "text-red-700"}>
                {data.database.ok ? "OK" : "Unreachable"}
              </strong>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Entity counts</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.counts).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-slate-500 capitalize">{key}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3">Service URLs</h2>
            <ul className="space-y-1 font-mono text-xs break-all">
              {Object.entries(data.services).map(([key, value]) => (
                <li key={key}>
                  <span className="text-slate-500">{key}:</span> {value ?? "—"}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
