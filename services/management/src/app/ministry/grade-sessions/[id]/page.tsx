"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canViewMinistryDashboard } from "@renis/core/permissions";
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
  grades: { subjectId: string; gradeObtained: number | null }[];
  semesterAverage: number | null;
};

type SessionStats = {
  studentCount: number;
  subjectCount: number;
  completionPercent?: number;
};

type SessionDetail = {
  session: {
    academicYear: string;
    semester: string;
    programme: { name: string; code: string };
    institution: { name: string; code: string };
  };
  subjects: Subject[];
  students: StudentRow[];
  stats?: SessionStats;
  anomalies: { code: string; message: string }[];
  ministryFlags: { at: string; actorEmail: string | null; message?: string }[];
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button,a,[role=menu]"));
}

function studentLabel(row: StudentRow) {
  return `${row.student.lastName}, ${row.student.firstName}`;
}

export default function MinistrySessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagMessage, setFlagMessage] = useState("");
  const [flagging, setFlagging] = useState(false);

  const [studentSearch, setStudentSearch] = useState("");
  const [flagsOpen, setFlagsOpen] = useState(true);
  const [studentDetail, setStudentDetail] = useState<StudentRow | null>(null);

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/ministry/grade-sessions/${id}`, {
        accessToken,
      });
      if (!res.ok) {
        setError(t("grades.session.couldNotLoad"));
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
      setError(data.error ?? t("ministry.diploma.flagFailed"));
      return;
    }
    setFlagMessage("");
    setFlagOpen(false);
    setMessage(t("ministry.diploma.flagSent"));
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
      setError(e instanceof Error ? e.message : t("ministry.exportFailed"));
    }
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

  if (loading) {
    return (
      <AppShell title={t("ministry.session.title")}>
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title={t("ministry.session.title")}>
        <Alert variant="error">{error ?? t("grades.session.notFound")}</Alert>
        <Link href="/ministry" className="text-sm text-renis-primary hover:underline">
          ← {t("ministry.title")}
        </Link>
      </AppShell>
    );
  }

  const { session: gradeSession, stats, anomalies, ministryFlags } = detail;
  const title = `${gradeSession.institution.name} — ${gradeSession.programme.name}`;

  return (
    <AppShell title={title}>
      <div className="mb-4">
        <Link href="/ministry" className="text-sm text-renis-primary hover:underline">
          ← {t("ministry.title")}
        </Link>
      </div>

      <PageHeader
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status="SUBMITTED" label={t("status.submitted")} />
            <span>
              {gradeSession.academicYear} · {gradeSession.semester} ·{" "}
              {t("ministry.readOnlyAudit")}
            </span>
            {stats ? (
              <span className="text-slate-500">
                ·{" "}
                {t("ministry.session.statsLine", {
                  students: stats.studentCount,
                  subjects: stats.subjectCount,
                })}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => void exportNational()}
            >
              {t("ministry.session.exportAll")}
            </button>
            <button
              type="button"
              className="renis-btn-primary"
              onClick={() => setFlagOpen(true)}
            >
              {t("ministry.diploma.flagAnomaly")}
            </button>
          </>
        }
      />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}
      {message ? (
        <Alert variant="success" onDismiss={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      {anomalies.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium mb-2">
            {t("ministry.session.anomaliesDetected", { count: anomalies.length })}
          </p>
          <ul className="list-disc list-inside space-y-1">
            {anomalies.map((a) => (
              <li key={`${a.code}-${a.message}`}>{a.message}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert variant="info">{t("ministry.session.noAnomalies")}</Alert>
      )}

      <Modal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title={t("ministry.diploma.flagAnomaly")}
        description={t("ministry.diploma.flagDescription")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setFlagOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="ministry-flag-form"
              disabled={flagging || flagMessage.trim().length < 10}
              className="renis-btn-primary disabled:opacity-50"
            >
              {flagging ? t("ministry.diploma.sending") : t("ministry.diploma.sendFlag")}
            </button>
          </div>
        }
      >
        <form id="ministry-flag-form" onSubmit={submitFlag}>
          <textarea
            required
            minLength={10}
            rows={4}
            className="renis-input w-full"
            placeholder={t("ministry.diploma.issuePlaceholder")}
            value={flagMessage}
            onChange={(e) => setFlagMessage(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={!!studentDetail}
        onClose={() => setStudentDetail(null)}
        title={studentDetail ? studentLabel(studentDetail) : t("ministry.session.studentTitle")}
        description={studentDetail?.student.studentIdNumber}
        size="lg"
        footer={
          <button type="button" className="renis-btn-secondary" onClick={() => setStudentDetail(null)}>
            {t("common.close")}
          </button>
        }
      >
        {studentDetail ? (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="text-slate-500">{t("grades.semesterAverage")}:</span>{" "}
              <strong className="tabular-nums">
                {studentDetail.semesterAverage !== null
                  ? studentDetail.semesterAverage.toFixed(2)
                  : t("common.dash")}
              </strong>
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3">{t("grades.subject")}</th>
                  <th className="py-2 text-right">{t("grades.grade")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.subjects.map((sub) => {
                  const g = studentDetail.grades.find((x) => x.subjectId === sub.id);
                  return (
                    <tr key={sub.id} className="border-t border-slate-50">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs text-slate-500">{sub.code}</span>{" "}
                        {sub.name}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {g?.gradeObtained ?? t("common.dash")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>

      {ministryFlags.length > 0 && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => setFlagsOpen((o) => !o)}
          >
            {t("ministry.diploma.previousFlags", { count: ministryFlags.length })}
            <span className="text-slate-400">{flagsOpen ? "▾" : "▸"}</span>
          </button>
          {flagsOpen && (
            <ul className="border-t border-slate-100 px-4 pb-4 space-y-2 text-sm">
              {ministryFlags.map((f, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="text-xs text-slate-500">
                    {new Date(f.at).toLocaleString()} — {f.actorEmail ?? t("common.dash")}
                  </span>
                  <p className="mt-1 text-slate-800">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder={t("ministry.session.filterStudents")}
          className="renis-input max-w-xs"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
        />
        {studentSearch.trim() ? (
          <span className="text-sm text-slate-500">
            {t("ministry.session.filterCount", {
              count: filteredTotal,
              total: detail.students.length,
            })}
          </span>
        ) : null}
        <span className="text-xs text-slate-500">{t("ministry.session.rowHint")}</span>
      </div>

      {detail.students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("ministry.session.noGradeRows")}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("ministry.session.noStudentMatch")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-2 sticky left-0 z-10 bg-slate-50 font-medium">
                  {t("ministry.col.student")}
                </th>
                {detail.subjects.map((s) => (
                  <th
                    key={s.id}
                    className="px-2 py-2 min-w-[3.5rem] font-medium"
                    title={s.name}
                  >
                    {s.code}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">{t("ministry.col.avg")}</th>
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
                  {row.grades.map((g, j) => (
                    <td key={j} className="px-2 py-2 tabular-nums text-slate-700">
                      {g.gradeObtained ?? t("common.dash")}
                    </td>
                  ))}
                  <td className="px-2 py-2 font-medium tabular-nums">
                    {row.semesterAverage !== null
                      ? row.semesterAverage.toFixed(2)
                      : t("common.dash")}
                  </td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={t("ministry.session.actionsLabel", { id: row.student.studentIdNumber })}
                      items={[
                        {
                          label: t("ministry.session.viewStudent"),
                          onClick: () => setStudentDetail(row),
                        },
                      ]}
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
