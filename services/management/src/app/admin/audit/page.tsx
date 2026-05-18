"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canViewAuditLog } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: unknown;
};

export default function AuditLogPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (session && !canViewAuditLog(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      setLoading(true);
      const q = filter ? `?action=${encodeURIComponent(filter)}` : "";
      const res = await apiFetch(`/api/audit-logs${q}`, {
        accessToken: session.accessToken,
      });
      if (res.ok) setLogs(await res.json());
      setLoading(false);
    })();
  }, [session?.accessToken, filter]);

  return (
    <AppShell title="Audit log">
      <p className="text-sm text-slate-600 mb-4">
        Immutable record of sensitive actions (spec §6.2). Super Admin only.
      </p>
      <div className="mb-4 flex gap-2">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Filter by action (e.g. USER_LOGIN)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onClick={() => setFilter("")}
        >
          Clear
        </button>
      </div>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-2">{row.actorEmail ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.entityType ?? "—"}
                    {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
