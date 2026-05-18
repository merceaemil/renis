"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";

type Subject = { id: string; code: string; name: string };
type StudentRow = {
  student: {
    id: string;
    studentIdNumber: string;
    firstName: string;
    lastName: string;
  };
  grades: {
    subjectId: string;
    gradeObtained: number | null;
    gradeMax: number;
  }[];
  semesterAverage: number | null;
  creditsValidated?: number;
  annualAverage?: number | null;
};

type SessionStats = {
  completionPercent: number;
  filledCells: number;
  expectedCells: number;
  studentCount: number;
  subjectCount: number;
  studentsWithMissingGrades?: number;
  noEnrollments?: boolean;
};

type SessionDetail = {
  session: {
    id: string;
    status: string;
    academicYear: string;
    semester: string;
    programme: { name: string; code: string };
  };
  subjects: Subject[];
  students: StudentRow[];
  stats?: SessionStats;
};

export default function GradeSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    { row: number; message: string }[]
  >([]);

  const editable = detail?.session.status === "DRAFT";
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/grade-sessions/${id}`, { accessToken });
      if (!res.ok) {
        setError("Could not load session");
        setLoading(false);
        return;
      }
      const data: SessionDetail = await res.json();
      setDetail(data);
      const initial: Record<string, string> = {};
      for (const row of data.students) {
        for (const g of row.grades) {
          const key = `${row.student.id}:${g.subjectId}`;
          initial[key] =
            g.gradeObtained !== null ? String(g.gradeObtained) : "";
        }
      }
      setDraft(initial);
      setLoading(false);
    },
    [id]
  );

  useEffect(() => {
    if (session && !canManageGrades(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken && id) void load(session.accessToken);
  }, [session?.accessToken, id, load]);

  useEffect(() => {
    if (!editable || !session?.accessToken || !id) return;
    const timer = setInterval(() => {
      const current = draftRef.current;
      const hasValues = Object.values(current).some((v) => v.trim() !== "");
      if (!hasValues) return;
      void (async () => {
        const grades = Object.entries(current)
          .filter(([, v]) => v.trim() !== "")
          .map(([key, value]) => {
            const [studentId, subjectId] = key.split(":");
            return {
              studentId: studentId!,
              subjectId: subjectId!,
              gradeObtained: Number(value),
            };
          });
        const res = await apiFetch(`/api/grade-sessions/${id}/grades`, {
          method: "PUT",
          accessToken: session.accessToken!,
          body: JSON.stringify({ grades }),
        });
        if (res.ok) setMessage("Auto-saved.");
      })();
    }, 30_000);
    return () => clearInterval(timer);
  }, [editable, session?.accessToken, id]);

  function cellKey(studentId: string, subjectId: string) {
    return `${studentId}:${subjectId}`;
  }

  async function saveGrades() {
    if (!session?.accessToken || !detail || !editable) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const grades = Object.entries(draft)
      .filter(([, v]) => v.trim() !== "")
      .map(([key, value]) => {
        const [studentId, subjectId] = key.split(":");
        return {
          studentId: studentId!,
          subjectId: subjectId!,
          gradeObtained: Number(value),
        };
      });

    const res = await apiFetch(`/api/grade-sessions/${id}/grades`, {
      method: "PUT",
      accessToken: session.accessToken,
      body: JSON.stringify({ grades }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setMessage(`Saved ${data.count} grade(s).`);
    await load(session.accessToken);
  }

  async function downloadTemplate() {
    if (!session?.accessToken || !detail) return;
    try {
      await downloadWithAuth(
        `/api/grade-sessions/${id}/template`,
        session.accessToken,
        `template-${detail.session.programme.code}.xlsx`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function exportGrades(format: "csv" | "xlsx") {
    if (!session?.accessToken || !detail) return;
    const ext = format === "xlsx" ? "xlsx" : "csv";
    try {
      await downloadWithAuth(
        `/api/grade-sessions/${id}/export?format=${format}`,
        session.accessToken,
        `grades-${detail.session.programme.code}.${ext}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function importExcel(file: File) {
    if (!session?.accessToken || !editable) return;
    setError(null);
    setImportErrors([]);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/grade-sessions/${id}/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setImportErrors(data.errors ?? []);
    setMessage(
      `Import: ${data.accepted} grade(s) saved, ${data.rejected} row error(s).`
    );
    await load(session.accessToken);
  }

  async function downloadTranscript(studentId: string, studentIdNumber: string) {
    if (!session?.accessToken) return;
    try {
      await downloadWithAuth(
        `/api/grade-sessions/${id}/transcript/${studentId}`,
        session.accessToken,
        `transcript-${studentIdNumber}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcript download failed");
    }
  }

  async function submitSession() {
    if (!session?.accessToken || !editable || !detail) return;
    const n = detail.stats?.filledCells ?? 0;
    const label = `${detail.session.programme.name}, ${detail.session.academicYear} ${detail.session.semester}`;
    if (
      !confirm(
        `Submit ${n} grade(s) for ${label} to the Ministry? The session cannot be edited after submission.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await apiFetch(`/api/grade-sessions/${id}/submit`, {
      method: "POST",
      accessToken: session.accessToken,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Submit failed");
      return;
    }
    setMessage("Session submitted.");
    await load(session.accessToken);
  }

  if (loading) {
    return (
      <AppShell title="Grade session">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title="Grade session">
        <p className="text-red-700">{error ?? "Not found"}</p>
        <Link href="/institution/grades" className="text-renis-primary text-sm">
          ← Back
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${detail.session.programme.name} — ${detail.session.academicYear} ${detail.session.semester}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/institution/grades" className="text-renis-primary hover:underline">
          ← All sessions
        </Link>
        <span
          className={
            detail.session.status === "SUBMITTED"
              ? "text-green-700 font-medium"
              : "text-amber-700 font-medium"
          }
        >
          {detail.session.status}
        </span>
        {editable && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveGrades()}
              className="rounded-lg bg-renis-primary px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save grades"}
            </button>
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              Excel template
            </button>
            <label className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
              Import Excel
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importExcel(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void submitSession()}
              className="rounded-lg border border-renis-primary px-3 py-1.5 text-renis-primary hover:bg-slate-50"
            >
              Submit to ministry
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void exportGrades("csv")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => void exportGrades("xlsx")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          Export Excel
        </button>
      </div>

      {detail.stats?.noEnrollments && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          No students are enrolled in this programme.{" "}
          <Link href="/institution/programmes" className="text-renis-primary underline">
            Enroll students
          </Link>{" "}
          before entering grades.
        </div>
      )}

      {detail.stats && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium text-slate-800 mb-1">Pre-submission summary</p>
          <p className="text-slate-600 mb-3">
            Completion: <strong>{detail.stats.completionPercent}%</strong> (
            {detail.stats.filledCells} / {detail.stats.expectedCells} cells) ·{" "}
            {detail.stats.studentCount} students · {detail.stats.subjectCount}{" "}
            subjects
            {detail.stats.studentsWithMissingGrades !== undefined &&
              detail.stats.studentsWithMissingGrades > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700">
                    {detail.stats.studentsWithMissingGrades} student(s) with
                    missing grades
                  </span>
                </>
              )}
          </p>
          {editable && detail.students.length > 0 && (
            <div className="overflow-x-auto max-h-48 border border-slate-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Student</th>
                    <th className="px-2 py-1 text-right">Sem. avg.</th>
                    <th className="px-2 py-1 text-right">Credits</th>
                    <th className="px-2 py-1 text-right">Annual avg.</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.students.map((row) => (
                    <tr key={row.student.id} className="border-t border-slate-100">
                      <td className="px-2 py-1">
                        {row.student.lastName}, {row.student.firstName}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">
                        {row.semesterAverage !== null
                          ? row.semesterAverage.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {row.creditsValidated ?? 0}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {row.annualAverage !== null && row.annualAverage !== undefined
                          ? row.annualAverage.toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {importErrors.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-h-40 overflow-y-auto">
          <p className="font-medium mb-1">Import rejected rows</p>
          <ul className="list-disc list-inside">
            {importErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-2 py-2 sticky left-0 bg-slate-50">Student</th>
              {detail.subjects.map((sub) => (
                <th key={sub.id} className="px-2 py-2 min-w-[4rem]" title={sub.name}>
                  {sub.code}
                </th>
              ))}
              <th className="px-2 py-2">Avg</th>
              <th className="px-2 py-2" title="Credits validated (grade ≥ pass threshold)">
                Cr.
              </th>
              <th className="px-2 py-2">Yr avg</th>
              {detail.session.status === "SUBMITTED" && (
                <th className="px-2 py-2">Transcript</th>
              )}
            </tr>
          </thead>
          <tbody>
            {detail.students.map((row) => (
              <tr key={row.student.id} className="border-t border-slate-100">
                <td className="px-2 py-2 sticky left-0 bg-white whitespace-nowrap">
                  {row.student.lastName}, {row.student.firstName}
                </td>
                {detail.subjects.map((sub) => {
                  const key = cellKey(row.student.id, sub.id);
                  const empty = !(draft[key] ?? "").trim();
                  return (
                    <td
                      key={sub.id}
                      className={`px-1 py-1 ${editable && empty ? "bg-orange-50" : ""}`}
                    >
                      {editable ? (
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          className={`w-14 rounded border px-1 py-0.5 ${
                            empty
                              ? "border-orange-300 bg-orange-50"
                              : "border-slate-200"
                          }`}
                          value={draft[key] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [key]: e.target.value }))
                          }
                        />
                      ) : (
                        <span>{draft[key] || "—"}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 font-medium">
                  {row.semesterAverage ?? "—"}
                </td>
                <td className="px-2 py-2">{row.creditsValidated ?? 0}</td>
                <td className="px-2 py-2">
                  {row.annualAverage ?? "—"}
                </td>
                {detail.session.status === "SUBMITTED" && (
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-renis-primary hover:underline whitespace-nowrap"
                      onClick={() =>
                        void downloadTranscript(
                          row.student.id,
                          row.student.studentIdNumber
                        )
                      }
                    >
                      PDF
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
