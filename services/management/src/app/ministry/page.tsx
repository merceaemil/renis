"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";

type Anomaly = { code: string; message: string; studentId?: string };

type NationalStatRow = {
  institutionName: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  studentCount: number;
  sessionAverage: number | null;
};

type MinistryDiploma = {
  id: string;
  status: string;
  uniqueCode: string | null;
  title: string;
  type: string;
  graduationYear: number;
  submittedAt: string | null;
  publishedAt: string | null;
  institution: { name: string; code: string };
  student: { displayName: string };
};

type MinistrySession = {
  id: string;
  academicYear: string;
  semester: string;
  submittedAt: string | null;
  institution: { code: string; name: string };
  programme: { code: string; name: string };
  gradeCount: number;
  anomalies: Anomaly[];
};

export default function MinistryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<MinistrySession[]>([]);
  const [diplomas, setDiplomas] = useState<MinistryDiploma[]>([]);
  const [stats, setStats] = useState<{
    summary: { submittedSessions: number; totalStudents: number; institutions: number };
    rows: NationalStatRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [sessionSort, setSessionSort] = useState<"date" | "institution">("date");

  useEffect(() => {
    if (session && !canViewMinistryDashboard(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken) void load(session.accessToken);
  }, [session?.accessToken]);

  async function load(accessToken: string) {
    setLoading(true);
    setError(null);
    try {
      const [sRes, dRes, stRes] = await Promise.all([
        apiFetch("/api/ministry/grade-sessions", { accessToken }),
        apiFetch("/api/ministry/diplomas", { accessToken }),
        apiFetch("/api/ministry/statistics", { accessToken }),
      ]);
      if (!sRes.ok) throw new Error("Could not load submitted sessions");
      setSessions(await sRes.json());
      if (dRes.ok) setDiplomas(await dRes.json());
      if (stRes.ok) setStats(await stRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function exportGrades() {
    if (!session?.accessToken) return;
    try {
      await downloadWithAuth(
        "/api/ministry/grade-sessions/export",
        session.accessToken,
        "national-grades-audit.csv"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function exportStatistics() {
    if (!session?.accessToken) return;
    try {
      await downloadWithAuth(
        "/api/ministry/statistics/export",
        session.accessToken,
        "national-statistics.csv"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const filteredSessions = [...sessions]
    .filter((s) => {
      const q = sessionFilter.trim().toLowerCase();
      if (!q) return true;
      return (
        s.institution.name.toLowerCase().includes(q) ||
        s.programme.name.toLowerCase().includes(q) ||
        s.institution.code.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sessionSort === "institution") {
        return a.institution.name.localeCompare(b.institution.name);
      }
      const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return db - da;
    });

  return (
    <AppShell title="Ministry overview">
      <p className="mb-4 text-sm text-slate-600 max-w-2xl">
        Read-only national audit: submitted grades, diploma records, and aggregated
        statistics (spec §4.2–4.4, §5.2–5.4).
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void exportGrades()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Export all grades (CSV)
        </button>
        <button
          type="button"
          onClick={() => void exportStatistics()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Export national statistics (CSV)
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <>
          {stats && (
            <section className="mb-10">
              <h2 className="text-lg font-medium text-slate-900 mb-3">
                National statistics
              </h2>
              <p className="text-sm text-slate-600 mb-3">
                {stats.summary.submittedSessions} submitted session(s) ·{" "}
                {stats.summary.institutions} institution(s) ·{" "}
                {stats.summary.totalStudents} student rows
              </p>
              {stats.rows.length === 0 ? (
                <p className="text-slate-500 text-sm">No data yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="px-3 py-2">Institution</th>
                        <th className="px-3 py-2">Programme</th>
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2">Sem.</th>
                        <th className="px-3 py-2">Students</th>
                        <th className="px-3 py-2">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.rows.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2">{r.institutionName}</td>
                          <td className="px-3 py-2">{r.programmeName}</td>
                          <td className="px-3 py-2">{r.academicYear}</td>
                          <td className="px-3 py-2">{r.semester}</td>
                          <td className="px-3 py-2">{r.studentCount}</td>
                          <td className="px-3 py-2">
                            {r.sessionAverage ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <h2 className="text-lg font-medium text-slate-900 mb-3">
            Submitted grade sessions
          </h2>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <input
              type="search"
              placeholder="Filter institution or programme…"
              className="rounded border border-slate-300 px-3 py-1.5"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            />
            <select
              className="rounded border border-slate-300 px-3 py-1.5"
              value={sessionSort}
              onChange={(e) =>
                setSessionSort(e.target.value as "date" | "institution")
              }
            >
              <option value="date">Sort by submitted date</option>
              <option value="institution">Sort by institution</option>
            </select>
          </div>
          {sessions.length === 0 ? (
            <p className="text-slate-500 mb-10">No submitted grade sessions yet.</p>
          ) : (
            <div className="space-y-4 mb-10">
              {filteredSessions.map((s) => (
                <article
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <h3 className="font-medium text-slate-900">
                      <Link
                        href={`/ministry/grade-sessions/${s.id}`}
                        className="text-renis-primary hover:underline"
                      >
                        {s.institution.name} — {s.programme.name}
                      </Link>
                    </h3>
                    <span className="text-xs text-slate-500">
                      {s.academicYear} · {s.semester} · {s.gradeCount} grades
                      {s.submittedAt &&
                        ` · ${new Date(s.submittedAt).toLocaleString()}`}
                    </span>
                  </div>
                  {s.anomalies.length === 0 ? (
                    <p className="text-sm text-green-700">
                      No auto-detected anomalies.
                    </p>
                  ) : (
                    <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                      {s.anomalies.slice(0, 3).map((a) => (
                        <li key={`${s.id}-${a.code}-${a.studentId ?? a.message}`}>
                          {a.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}

          <h2 className="text-lg font-medium text-slate-900 mb-3">
            Diplomas (submitted & published)
          </h2>
          {diplomas.length === 0 ? (
            <p className="text-slate-500">No diplomas submitted yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Diploma</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {diplomas.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{d.institution.name}</td>
                      <td className="px-4 py-3">{d.student.displayName}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/ministry/diplomas/${d.id}`}
                          className="text-renis-primary hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{d.status}</td>
                      <td className="px-4 py-3">
                        {d.submittedAt
                          ? new Date(d.submittedAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
