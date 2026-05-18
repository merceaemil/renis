"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";

type Anomaly = { code: string; message: string; studentId?: string };

type NationalStatRow = {
  institutionName: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  studentCount: number;
  sessionAverage: number | null;
};

type StatsSummary = {
  submittedSessions: number;
  totalStudents: number;
  institutions: number;
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
  const [error, setError] = useState<string | null>(null);
  const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [sessionSort, setSessionSort] = useState<"date" | "institution">("date");

  useEffect(() => {
    if (session && !canViewMinistryDashboard(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchStatsPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const res = await apiFetch(
        listApiUrl("/api/ministry/statistics", page, pageSize),
        { accessToken: session.accessToken }
      );
      if (!res.ok) throw new Error("Could not load statistics");
      const data = await res.json();
      setStatsSummary(data.summary as StatsSummary);
      return {
        items: data.rows as NationalStatRow[],
        total: data.total as number,
        page: data.page as number,
        pageSize: data.pageSize as number,
        totalPages: data.totalPages as number,
      };
    },
    [session?.accessToken]
  );

  const fetchSessionsPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const q = sessionFilter.trim();
      const url = listApiUrl("/api/ministry/grade-sessions", page, pageSize, {
        ...(q ? { q } : {}),
        sort: sessionSort,
      });
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error("Could not load submitted sessions");
      return normalizeListResponse<MinistrySession>(await res.json());
    },
    [session?.accessToken, sessionFilter, sessionSort]
  );

  const fetchDiplomasPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const res = await apiFetch(
        listApiUrl("/api/ministry/diplomas", page, pageSize),
        { accessToken: session.accessToken }
      );
      if (!res.ok) throw new Error("Could not load diplomas");
      return normalizeListResponse<MinistryDiploma>(await res.json());
    },
    [session?.accessToken]
  );

  const {
    items: statRows,
    loading: statsLoading,
    page: statsPage,
    setPage: setStatsPage,
    pageSize: statsPageSize,
    setPageSize: setStatsPageSize,
    total: statsTotal,
    totalPages: statsTotalPages,
  } = usePaginatedList(fetchStatsPage, [session?.accessToken]);

  const {
    items: sessions,
    loading: sessionsLoading,
    page: sessionsPage,
    setPage: setSessionsPage,
    pageSize: sessionsPageSize,
    setPageSize: setSessionsPageSize,
    total: sessionsTotal,
    totalPages: sessionsTotalPages,
  } = usePaginatedList(fetchSessionsPage, [
    session?.accessToken,
    sessionFilter,
    sessionSort,
  ]);

  const {
    items: diplomas,
    loading: diplomasLoading,
    page: diplomasPage,
    setPage: setDiplomasPage,
    pageSize: diplomasPageSize,
    setPageSize: setDiplomasPageSize,
    total: diplomasTotal,
    totalPages: diplomasTotalPages,
  } = usePaginatedList(fetchDiplomasPage, [session?.accessToken]);

  const initialLoading =
    statsLoading && sessionsLoading && diplomasLoading && !statsSummary;

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

  return (
    <AppShell title="Ministry overview">
      <PageHeader
        description="Read-only national audit: submitted grades, diploma records, and aggregated statistics."
        actions={
          <>
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => void exportGrades()}
            >
              Export grades (CSV)
            </button>
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => void exportStatistics()}
            >
              Export statistics (CSV)
            </button>
          </>
        }
      />

      {error ? (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {initialLoading ? (
        <p className="text-slate-500 py-8">Loading…</p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="text-lg font-medium text-slate-900 mb-3">
              National statistics
            </h2>
            {statsSummary ? (
              <p className="text-sm text-slate-600 mb-3">
                {statsSummary.submittedSessions} submitted session(s) ·{" "}
                {statsSummary.institutions} institution(s) ·{" "}
                {statsSummary.totalStudents} student rows
              </p>
            ) : null}
            {statsLoading ? (
              <p className="text-slate-500 text-sm">Loading statistics…</p>
            ) : statsTotal === 0 ? (
              <p className="text-slate-500 text-sm">No data yet.</p>
            ) : (
              <PaginatedTable
                page={statsPage}
                pageSize={statsPageSize}
                total={statsTotal}
                totalPages={statsTotalPages}
                onPageChange={setStatsPage}
                onPageSizeChange={setStatsPageSize}
              >
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Institution</th>
                      <th className="px-3 py-2 font-medium">Programme</th>
                      <th className="px-3 py-2 font-medium">Year</th>
                      <th className="px-3 py-2 font-medium">Sem.</th>
                      <th className="px-3 py-2 font-medium">Students</th>
                      <th className="px-3 py-2 font-medium">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statRows.map((r, i) => (
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
              </PaginatedTable>
            )}
          </section>

          <h2 className="text-lg font-medium text-slate-900 mb-3">
            Submitted grade sessions
          </h2>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <input
              type="search"
              placeholder="Filter institution or programme…"
              className="renis-input max-w-xs"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            />
            <select
              className="renis-input max-w-xs"
              value={sessionSort}
              onChange={(e) =>
                setSessionSort(e.target.value as "date" | "institution")
              }
            >
              <option value="date">Sort by submitted date</option>
              <option value="institution">Sort by institution</option>
            </select>
          </div>
          {sessionsLoading ? (
            <p className="text-slate-500 mb-10 text-sm">Loading sessions…</p>
          ) : sessionsTotal === 0 ? (
            <p className="text-slate-500 mb-10">
              {sessionFilter.trim()
                ? "No sessions match your filter."
                : "No submitted grade sessions yet."}
            </p>
          ) : (
            <div className="mb-10">
              <PaginatedTable
                page={sessionsPage}
                pageSize={sessionsPageSize}
                total={sessionsTotal}
                totalPages={sessionsTotalPages}
                onPageChange={setSessionsPage}
                onPageSizeChange={setSessionsPageSize}
              >
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Institution</th>
                      <th className="px-4 py-3 font-medium">Programme</th>
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium">Grades</th>
                      <th className="px-4 py-3 font-medium">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className="renis-table-row"
                        onClick={() =>
                          router.push(`/ministry/grade-sessions/${s.id}`)
                        }
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {s.institution.name}
                        </td>
                        <td className="px-4 py-3">{s.programme.name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.academicYear} · {s.semester}
                          {s.submittedAt && (
                            <span className="block text-xs text-slate-400">
                              {new Date(s.submittedAt).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{s.gradeCount}</td>
                        <td className="px-4 py-3">
                          {s.anomalies.length === 0 ? (
                            <span className="text-green-700 text-xs">None</span>
                          ) : (
                            <span className="text-amber-800 text-xs">
                              {s.anomalies.length} flagged
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PaginatedTable>
            </div>
          )}

          <h2 className="text-lg font-medium text-slate-900 mb-3">
            Diplomas (submitted & published)
          </h2>
          {diplomasLoading ? (
            <p className="text-slate-500 text-sm">Loading diplomas…</p>
          ) : diplomasTotal === 0 ? (
            <p className="text-slate-500">No diplomas submitted yet.</p>
          ) : (
            <PaginatedTable
              page={diplomasPage}
              pageSize={diplomasPageSize}
              total={diplomasTotal}
              totalPages={diplomasTotalPages}
              onPageChange={setDiplomasPage}
              onPageSizeChange={setDiplomasPageSize}
            >
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Institution</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Diploma</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {diplomas.map((d) => (
                    <tr
                      key={d.id}
                      className="renis-table-row"
                      onClick={() => router.push(`/ministry/diplomas/${d.id}`)}
                    >
                      <td className="px-4 py-3">{d.institution.name}</td>
                      <td className="px-4 py-3">{d.student.displayName}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {d.title}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {d.submittedAt
                          ? new Date(d.submittedAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PaginatedTable>
          )}
        </>
      )}
    </AppShell>
  );
}
