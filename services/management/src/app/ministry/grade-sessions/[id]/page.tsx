"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";

type SessionDetail = {
  session: {
    academicYear: string;
    semester: string;
    programme: { name: string; code: string };
    institution: { name: string; code: string };
  };
  subjects: { id: string; code: string; name: string }[];
  students: {
    student: { lastName: string; firstName: string };
    grades: { gradeObtained: number | null }[];
    semesterAverage: number | null;
  }[];
  anomalies: { code: string; message: string }[];
  ministryFlags: { at: string; actorEmail: string | null; message?: string }[];
};

export default function MinistrySessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagMessage, setFlagMessage] = useState("");
  const [flagging, setFlagging] = useState(false);

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/ministry/grade-sessions/${id}`, {
        accessToken,
      });
      if (!res.ok) {
        setError("Could not load session");
        setLoading(false);
        return;
      }
      setDetail(await res.json());
      setLoading(false);
    },
    [id]
  );

  useEffect(() => {
    if (session && !canViewMinistryDashboard(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken && id) void load(session.accessToken);
  }, [session?.accessToken, id, load]);

  async function submitFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || flagMessage.trim().length < 10) return;
    setFlagging(true);
    setError(null);
    const res = await apiFetch(`/api/ministry/grade-sessions/${id}/flag`, {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({ message: flagMessage.trim() }),
    });
    setFlagging(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not send flag");
      return;
    }
    setFlagMessage("");
    await load(session.accessToken);
  }

  async function exportNational() {
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

  if (loading) {
    return (
      <AppShell title="Session audit">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title="Session audit">
        <p className="text-red-700">{error ?? "Not found"}</p>
        <Link href="/ministry" className="text-renis-primary text-sm">
          ← Ministry overview
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${detail.session.institution.name} — ${detail.session.programme.name}`}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/ministry" className="text-renis-primary hover:underline">
          ← Ministry overview
        </Link>
        <button
          type="button"
          onClick={() => void exportNational()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          Export all sessions (CSV)
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-600">
        {detail.session.academicYear} · {detail.session.semester} · read-only
        audit (spec §4.2 step 4)
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {detail.anomalies.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
          <p className="font-medium text-amber-900 mb-2">Auto-detected anomalies</p>
          <ul className="list-disc list-inside text-amber-800">
            {detail.anomalies.map((a) => (
              <li key={`${a.code}-${a.studentId ?? a.message}`}>{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={submitFlag}
        className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p className="text-sm font-medium text-slate-800 mb-2">Flag anomaly</p>
        <textarea
          required
          minLength={10}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Describe the issue for the institution (min. 10 characters)…"
          value={flagMessage}
          onChange={(e) => setFlagMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={flagging}
          className="mt-2 rounded-lg bg-renis-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {flagging ? "Sending…" : "Send flag to institution"}
        </button>
      </form>

      {detail.ministryFlags.length > 0 && (
        <div className="mb-6 text-sm">
          <p className="font-medium text-slate-800 mb-2">Previous ministry flags</p>
          <ul className="space-y-2">
            {detail.ministryFlags.map((f, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-xs text-slate-500">
                  {new Date(f.at).toLocaleString()} — {f.actorEmail ?? "—"}
                </span>
                <p className="mt-1">{f.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-2 py-2">Student</th>
              {detail.subjects.map((s) => (
                <th key={s.id} className="px-2 py-2">
                  {s.code}
                </th>
              ))}
              <th className="px-2 py-2">Avg</th>
            </tr>
          </thead>
          <tbody>
            {detail.students.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-2 whitespace-nowrap">
                  {row.student.lastName}, {row.student.firstName}
                </td>
                {row.grades.map((g, j) => (
                  <td key={j} className="px-2 py-2">
                    {g.gradeObtained ?? "—"}
                  </td>
                ))}
                <td className="px-2 py-2 font-medium">
                  {row.semesterAverage ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
