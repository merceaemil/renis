"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowMenu } from "@/components/ui/RowMenu";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";
import { useT } from "@/lib/i18n/LocaleProvider";

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

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input,button,a,label,[role=menu],select,textarea")
  );
}

export default function GradeSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    { row: number; message: string }[]
  >([]);

  const [studentSearch, setStudentSearch] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrorsOpen, setImportErrorsOpen] = useState(false);
  const [studentDetail, setStudentDetail] = useState<StudentRow | null>(null);

  const editable = detail?.session.status === "DRAFT";
  const submitted = detail?.session.status === "SUBMITTED";
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/grade-sessions/${id}`, { accessToken });
      if (!res.ok) {
        setError(t("grades.session.couldNotLoad"));
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
    [id, t]
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
        if (res.ok) setMessage(t("grades.session.autoSavedToast"));
      })();
    }, 30_000);
    return () => clearInterval(timer);
  }, [editable, session?.accessToken, id, t]);

  function cellKey(studentId: string, subjectId: string) {
    return `${studentId}:${subjectId}`;
  }

  function studentLabel(row: StudentRow) {
    return `${row.student.lastName}, ${row.student.firstName}`;
  }

  const filteredStudents =
    detail?.students.filter((row) => {
      const q = studentSearch.trim().toLowerCase();
      if (!q) return true;
      const s = row.student;
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.studentIdNumber.toLowerCase().includes(q)
      );
    }) ?? [];

  const {
    pageItems: pagedStudents,
    page: studentPage,
    setPage: setStudentPage,
    pageSize: studentPageSize,
    setPageSize: setStudentPageSize,
    total: filteredTotal,
    totalPages: studentTotalPages,
  } = useClientPagination(filteredStudents, [studentSearch]);

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
      setError(data.error ?? t("grades.session.saveFailed"));
      return;
    }
    setMessage(t("grades.session.saved", { count: data.count }));
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
      setError(
        e instanceof Error ? e.message : t("grades.session.downloadFailed")
      );
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
      setError(
        e instanceof Error ? e.message : t("grades.session.exportFailed")
      );
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
      setError(data.error ?? t("grades.session.importFailed"));
      return;
    }
    const errors = data.errors ?? [];
    setImportErrors(errors);
    setImportOpen(false);
    setMessage(
      t("grades.session.importSummary", {
        accepted: data.accepted,
        rejected: data.rejected,
      })
    );
    if (errors.length > 0) setImportErrorsOpen(true);
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
      setMessage(
        t("grades.session.transcriptDownloaded", { id: studentIdNumber })
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("grades.session.transcriptDownloadFailed")
      );
    }
  }

  async function confirmSubmit() {
    if (!session?.accessToken || !editable || !detail) return;
    setSubmitting(true);
    setError(null);
    const res = await apiFetch(`/api/grade-sessions/${id}/submit`, {
      method: "POST",
      accessToken: session.accessToken,
    });
    const data = await res.json();
    setSubmitting(false);
    setSubmitOpen(false);
    if (!res.ok) {
      setError(data.error ?? t("grades.session.submitFailed"));
      return;
    }
    setMessage(t("grades.session.submittedToast"));
    await load(session.accessToken);
  }

  function rowMenuItems(row: StudentRow) {
    const items = [
      {
        label: t("grades.session.viewStudent"),
        onClick: () => setStudentDetail(row),
      },
    ];
    if (submitted) {
      items.push({
        label: t("grades.session.downloadTranscript"),
        onClick: () =>
          void downloadTranscript(row.student.id, row.student.studentIdNumber),
      });
    }
    return items;
  }

  if (loading) {
    return (
      <AppShell title={t("grades.session.title")}>
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title={t("grades.session.title")}>
        <Alert variant="error">{error ?? t("grades.session.notFound")}</Alert>
        <Link href="/institution/grades" className="text-renis-primary text-sm hover:underline">
          {t("grades.session.allSessions")}
        </Link>
      </AppShell>
    );
  }

  const { session: gradeSession, stats } = detail;
  const title = `${gradeSession.programme.name} — ${gradeSession.academicYear} ${gradeSession.semester}`;

  return (
    <AppShell title={title}>
      <div className="mb-4">
        <Link href="/institution/grades" className="text-sm text-renis-primary hover:underline">
          {t("grades.session.allSessions")}
        </Link>
      </div>

      <PageHeader
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={gradeSession.status} />
            {stats ? (
              <span>
                {t("grades.session.stats", {
                  percent: stats.completionPercent,
                  students: stats.studentCount,
                  subjects: stats.subjectCount,
                })}
              </span>
            ) : null}
            {editable ? (
              <span className="text-slate-500">
                {t("grades.session.autoSaveHint")}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            {editable && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  className="renis-btn-primary"
                  onClick={() => void saveGrades()}
                >
                  {saving
                    ? t("common.saving")
                    : t("grades.session.saveGrades")}
                </button>
                <button
                  type="button"
                  className="renis-btn-secondary"
                  onClick={() => setSubmitOpen(true)}
                >
                  {t("grades.session.submitToMinistry")}
                </button>
                <button
                  type="button"
                  className="renis-btn-secondary"
                  onClick={() => void downloadTemplate()}
                >
                  {t("grades.session.excelTemplate")}
                </button>
                <button
                  type="button"
                  className="renis-btn-secondary"
                  onClick={() => setImportOpen(true)}
                >
                  {t("grades.session.importExcel")}
                </button>
              </>
            )}
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => void exportGrades("csv")}
            >
              {t("grades.session.exportCsv")}
            </button>
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => void exportGrades("xlsx")}
            >
              {t("grades.session.exportExcel")}
            </button>
          </>
        }
      />

      {stats && (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              stats.completionPercent >= 100
                ? "bg-emerald-500"
                : "bg-renis-primary"
            }`}
            style={{ width: `${Math.min(100, stats.completionPercent)}%` }}
          />
        </div>
      )}

      {stats?.noEnrollments ? (
        <Alert variant="warning">
          {t("grades.session.noEnrollments")}{" "}
          <Link href="/institution/programmes" className="font-medium underline">
            {t("grades.session.enrollStudents")}
          </Link>{" "}
          {t("grades.session.beforeGrades")}
        </Alert>
      ) : null}

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}
      {message ? (
        <Alert variant="success" onDismiss={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title={t("grades.session.submitTitle")}
        description={t("grades.session.submitDescription")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setSubmitOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={submitting}
              className="renis-btn-primary disabled:opacity-50"
              onClick={() => void confirmSubmit()}
            >
              {submitting
                ? t("grades.session.submitting")
                : t("grades.session.confirmSubmit")}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          {t("grades.session.submitPreview", {
            filled: stats?.filledCells ?? 0,
            programme: gradeSession.programme.name,
            year: gradeSession.academicYear,
            semester: gradeSession.semester,
          })}
        </p>
        {stats && stats.studentsWithMissingGrades !== undefined &&
          stats.studentsWithMissingGrades > 0 && (
            <p className="mt-3 text-sm text-amber-800">
              {t("grades.session.studentsMissing", {
                count: stats.studentsWithMissingGrades,
              })}
            </p>
          )}
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t("grades.session.importTitle")}
        description={t("grades.session.importDescription")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setImportOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="renis-btn-primary"
              onClick={() => importInputRef.current?.click()}
            >
              {t("grades.session.chooseFile")}
            </button>
          </div>
        }
      >
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importExcel(f);
          }}
        />
        <p className="text-sm text-slate-600">
          {t("grades.session.templateHelp")}{" "}
          <button
            type="button"
            className="text-renis-primary underline"
            onClick={() => void downloadTemplate()}
          >
            {t("grades.session.templateLink")}
          </button>{" "}
          {t("grades.session.templateAfter")}
        </p>
      </Modal>

      <Modal
        open={importErrorsOpen}
        onClose={() => setImportErrorsOpen(false)}
        title={t("grades.session.importErrorsTitle")}
        size="lg"
        footer={
          <button type="button" className="renis-btn-secondary" onClick={() => setImportErrorsOpen(false)}>
            {t("common.close")}
          </button>
        }
      >
        <ul className="max-h-64 overflow-y-auto text-sm list-disc list-inside space-y-1 text-amber-900">
          {importErrors.map((e, i) => (
            <li key={i}>
              {t("grades.session.importRow", {
                row: e.row,
                message: e.message,
              })}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={!!studentDetail}
        onClose={() => setStudentDetail(null)}
        title={
          studentDetail
            ? studentLabel(studentDetail)
            : t("grades.session.studentDetail")
        }
        description={studentDetail?.student.studentIdNumber}
        size="lg"
        footer={
          studentDetail ? (
            <div className="flex justify-end gap-2">
              <button type="button" className="renis-btn-secondary" onClick={() => setStudentDetail(null)}>
                {t("common.close")}
              </button>
              {submitted ? (
                <button
                  type="button"
                  className="renis-btn-primary"
                  onClick={() =>
                    void downloadTranscript(
                      studentDetail.student.id,
                      studentDetail.student.studentIdNumber
                    )
                  }
                >
                  {t("grades.session.downloadTranscriptShort")}
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {studentDetail && detail ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">
                  {t("grades.session.semesterAverage")}
                </dt>
                <dd className="font-medium text-slate-900">
                  {studentDetail.semesterAverage !== null
                    ? studentDetail.semesterAverage.toFixed(2)
                    : t("common.dash")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("grades.session.creditsValidated")}
                </dt>
                <dd className="font-medium text-slate-900">
                  {studentDetail.creditsValidated ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("grades.session.annualAverage")}
                </dt>
                <dd className="font-medium text-slate-900">
                  {studentDetail.annualAverage !== null &&
                  studentDetail.annualAverage !== undefined
                    ? studentDetail.annualAverage.toFixed(2)
                    : t("common.dash")}
                </dd>
              </div>
            </dl>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3">
                    {t("grades.session.subjectCol")}
                  </th>
                  <th className="py-2 text-right">
                    {t("grades.session.gradeCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.subjects.map((sub) => {
                  const key = cellKey(studentDetail.student.id, sub.id);
                  const val = draft[key]?.trim();
                  return (
                    <tr key={sub.id} className="border-t border-slate-50">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs text-slate-500">{sub.code}</span>{" "}
                        {sub.name}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {val || t("common.dash")}
                        {val ? <span className="text-slate-400 font-normal"> / 20</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>

      {stats && detail.students.length > 0 && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => setSummaryOpen((o) => !o)}
          >
            {t("grades.session.summary")}
            <span className="text-slate-400">{summaryOpen ? "▾" : "▸"}</span>
          </button>
          {summaryOpen && (
            <div className="border-t border-slate-100 px-4 pb-4">
              <p className="text-sm text-slate-600 py-3">
                {t("grades.session.cellsFilled", {
                  filled: stats.filledCells,
                  expected: stats.expectedCells,
                })}
                {stats.studentsWithMissingGrades !== undefined &&
                  stats.studentsWithMissingGrades > 0 && (
                    <span className="text-amber-700">
                      {t("grades.session.studentsMissingInline", {
                        count: stats.studentsWithMissingGrades,
                      })}
                    </span>
                  )}
              </p>
              <div className="overflow-x-auto max-h-48 rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">
                        {t("grades.session.col.student")}
                      </th>
                      <th className="px-2 py-1 text-right font-medium">
                        {t("grades.session.col.semAvg")}
                      </th>
                      <th className="px-2 py-1 text-right font-medium">
                        {t("grades.session.col.credits")}
                      </th>
                      <th className="px-2 py-1 text-right font-medium">
                        {t("grades.session.col.annualAvg")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.students.map((row) => (
                      <tr
                        key={row.student.id}
                        className="renis-table-row border-t border-slate-100"
                        onClick={(e) => {
                          if (isInteractiveTarget(e.target)) return;
                          setStudentDetail(row);
                        }}
                      >
                        <td className="px-2 py-1">{studentLabel(row)}</td>
                        <td className="px-2 py-1 text-right font-medium">
                          {row.semesterAverage !== null
                            ? row.semesterAverage.toFixed(2)
                            : t("common.dash")}
                        </td>
                        <td className="px-2 py-1 text-right">{row.creditsValidated ?? 0}</td>
                        <td className="px-2 py-1 text-right">
                          {row.annualAverage !== null && row.annualAverage !== undefined
                            ? row.annualAverage.toFixed(2)
                            : t("common.dash")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder={t("grades.session.filterStudents")}
          className="renis-input max-w-xs"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
        />
        {studentSearch.trim() ? (
          <span className="text-sm text-slate-500">
            {t("grades.session.matchCount", {
              filtered: filteredTotal,
              total: detail.students.length,
            })}
          </span>
        ) : null}
        {editable ? (
          <span className="text-xs text-slate-500">
            {t("grades.session.emptyHint")}
          </span>
        ) : null}
      </div>

      {detail.students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("grades.session.noEnrolledStudents")}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("grades.session.noMatch")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-2 sticky left-0 z-10 bg-slate-50 font-medium">
                  {t("grades.session.col.student")}
                </th>
                {detail.subjects.map((sub) => (
                  <th
                    key={sub.id}
                    className="px-2 py-2 min-w-[4rem] font-medium"
                    title={sub.name}
                  >
                    {sub.code}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">
                  {t("grades.session.col.avg")}
                </th>
                <th
                  className="px-2 py-2 font-medium"
                  title={t("grades.session.creditsTooltip")}
                >
                  {t("grades.session.col.credShort")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("grades.session.col.yrAvg")}
                </th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {pagedStudents.map((row) => (
                <tr
                  key={row.student.id}
                  className="renis-table-row border-t border-slate-100"
                  onClick={(e) => {
                    if (isInteractiveTarget(e.target)) return;
                    setStudentDetail(row);
                  }}
                >
                  <td className="px-2 py-2 sticky left-0 z-10 bg-white whitespace-nowrap font-medium text-slate-900">
                    {studentLabel(row)}
                    <span className="block font-mono text-[10px] font-normal text-slate-400">
                      {row.student.studentIdNumber}
                    </span>
                  </td>
                  {detail.subjects.map((sub) => {
                    const key = cellKey(row.student.id, sub.id);
                    const empty = !(draft[key] ?? "").trim();
                    return (
                      <td
                        key={sub.id}
                        className={`px-1 py-1 ${editable && empty ? "bg-orange-50" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.25}
                            className={`w-14 rounded border px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-renis-primary/30 ${
                              empty
                                ? "border-orange-300 bg-orange-50"
                                : "border-slate-200 bg-white"
                            }`}
                            value={draft[key] ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, [key]: e.target.value }))
                            }
                          />
                        ) : (
                          <span className="tabular-nums">{draft[key] || t("common.dash")}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 font-medium tabular-nums">
                    {row.semesterAverage ?? t("common.dash")}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{row.creditsValidated ?? 0}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {row.annualAverage ?? t("common.dash")}
                  </td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={t("common.actionsFor", {
                        target: row.student.studentIdNumber,
                      })}
                      items={rowMenuItems(row)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={studentPage}
            pageSize={studentPageSize}
            total={filteredTotal}
            totalPages={studentTotalPages}
            onPageChange={setStudentPage}
            onPageSizeChange={setStudentPageSize}
          />
        </div>
      )}
    </AppShell>
  );
}
