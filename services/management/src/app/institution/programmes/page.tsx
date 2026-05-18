"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name: string;
  semester: string;
  yearLevel: number;
  credits: number;
  coefficient: number;
};

type Programme = {
  id: string;
  code: string;
  name: string;
  subjects: Subject[];
};

export default function ProgrammesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeId, setScopeId] = useState("");
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const [subjectFor, setSubjectFor] = useState<string | null>(null);
  const [programmeForm, setProgrammeForm] = useState({ code: "", name: "" });
  const [subjectForm, setSubjectForm] = useState({
    code: "",
    name: "",
    semester: "S1",
    yearLevel: 1,
    credits: 3,
    coefficient: 1,
  });
  const [enrollFor, setEnrollFor] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<
    { id: string; studentIdNumber: string; firstName: string; lastName: string }[]
  >([]);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [selectedEnroll, setSelectedEnroll] = useState<string[]>([]);

  useEffect(() => {
    if (session && !canManageGrades(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken) void load(session.accessToken, scopeId);
  }, [session?.accessToken, scopeId]);

  async function load(accessToken: string, institutionId?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        withInstitutionQuery("/api/programmes", institutionId),
        { accessToken }
      );
      if (!res.ok) throw new Error("Could not load programmes");
      setProgrammes(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function createProgramme(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    const institutionId = scopedInstitutionIdForCreate();
    const res = await apiFetch("/api/programmes", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({
        ...programmeForm,
        ...(institutionId ? { institutionId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Creation failed");
      return;
    }
    setShowProgrammeForm(false);
    setProgrammeForm({ code: "", name: "" });
    await load(session.accessToken, scopeId);
  }

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !subjectFor) return;
    const res = await apiFetch(`/api/programmes/${subjectFor}/subjects`, {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(subjectForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add subject");
      return;
    }
    setSubjectFor(null);
    setSubjectForm({
      code: "",
      name: "",
      semester: "S1",
      yearLevel: 1,
      credits: 3,
      coefficient: 1,
    });
    await load(session.accessToken, scopeId);
  }

  async function openEnrollment(programmeId: string) {
    if (!session?.accessToken) return;
    setEnrollFor(programmeId);
    setError(null);
    const [sRes, eRes] = await Promise.all([
      apiFetch(withInstitutionQuery("/api/students", scopeId), {
        accessToken: session.accessToken,
      }),
      apiFetch(`/api/programmes/${programmeId}/enrollments`, {
        accessToken: session.accessToken,
      }),
    ]);
    if (sRes.ok) setAllStudents(await sRes.json());
    if (eRes.ok) {
      const enrolled: { student: { id: string } }[] = await eRes.json();
      const ids = enrolled.map((e) => e.student.id);
      setEnrolledIds(ids);
      setSelectedEnroll(ids);
    }
  }

  async function saveEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !enrollFor) return;
    const res = await apiFetch(`/api/programmes/${enrollFor}/enrollments`, {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({ studentIds: selectedEnroll }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Enrollment failed");
      return;
    }
    setEnrollFor(null);
  }

  return (
    <AppShell title="Programmes & subjects">
      <InstitutionScopeBar onChange={setScopeId} />

      <p className="mb-4 text-sm text-slate-600 max-w-2xl">
        Define programmes, subjects, and student enrollments (spec §4.1). Grade
        grids only show students enrolled in the programme.
      </p>

      <button
        type="button"
        onClick={() => setShowProgrammeForm((v) => !v)}
        className="mb-4 rounded-lg bg-renis-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {showProgrammeForm ? "Cancel" : "New programme"}
      </button>

      {showProgrammeForm && (
        <form
          onSubmit={(e) => void createProgramme(e)}
          className="mb-6 grid gap-3 md:grid-cols-2 rounded-xl border border-slate-200 bg-white p-4"
        >
          <label className="text-sm">
            Code
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={programmeForm.code}
              onChange={(e) =>
                setProgrammeForm({ ...programmeForm, code: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            Name
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={programmeForm.name}
              onChange={(e) =>
                setProgrammeForm({ ...programmeForm, name: e.target.value })
              }
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-renis-primary px-4 py-2 text-sm text-white"
            >
              Create programme
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : programmes.length === 0 ? (
        <p className="text-slate-500">No programmes yet.</p>
      ) : (
        <div className="space-y-6">
          {programmes.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <h2 className="font-medium text-slate-900">
                  {p.code} — {p.name}
                </h2>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-sm text-renis-primary hover:underline"
                    onClick={() => void openEnrollment(p.id)}
                  >
                    Enroll students
                  </button>
                  <button
                    type="button"
                    className="text-sm text-renis-primary hover:underline"
                    onClick={() =>
                      setSubjectFor((cur) => (cur === p.id ? null : p.id))
                    }
                  >
                    {subjectFor === p.id ? "Cancel subject" : "Add subject"}
                  </button>
                </div>
              </div>

              {enrollFor === p.id && (
                <form
                  onSubmit={(e) => void saveEnrollment(e)}
                  className="mb-4 border-t border-slate-100 pt-3 text-sm"
                >
                  <p className="text-slate-600 mb-2">
                    Select students enrolled in this programme:
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-slate-100 rounded p-2 space-y-1">
                    {allStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEnroll.includes(s.id)}
                          onChange={(e) => {
                            setSelectedEnroll((prev) =>
                              e.target.checked
                                ? [...prev, s.id]
                                : prev.filter((id) => id !== s.id)
                            );
                          }}
                        />
                        {s.lastName}, {s.firstName} ({s.studentIdNumber})
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Currently enrolled: {enrolledIds.length}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-renis-primary px-3 py-1.5 text-white text-sm"
                    >
                      Save enrollment
                    </button>
                    <button
                      type="button"
                      className="text-sm text-slate-600"
                      onClick={() => setEnrollFor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {subjectFor === p.id && (
                <form
                  onSubmit={(e) => void addSubject(e)}
                  className="mb-4 grid gap-2 md:grid-cols-3 text-sm border-t border-slate-100 pt-3"
                >
                  <label>
                    Subject code
                    <input
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.code}
                      onChange={(e) =>
                        setSubjectForm({ ...subjectForm, code: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Name
                    <input
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.name}
                      onChange={(e) =>
                        setSubjectForm({ ...subjectForm, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Semester
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.semester}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          semester: e.target.value,
                        })
                      }
                    >
                      <option value="S1">S1</option>
                      <option value="S2">S2</option>
                    </select>
                  </label>
                  <label>
                    Year level
                    <input
                      type="number"
                      min={1}
                      max={6}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.yearLevel}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          yearLevel: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Credits
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.credits}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          credits: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Coefficient
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      value={subjectForm.coefficient}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          coefficient: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-renis-primary px-3 py-1.5 text-white text-sm"
                    >
                      Save subject
                    </button>
                  </div>
                </form>
              )}

              {p.subjects.length === 0 ? (
                <p className="text-sm text-slate-500">No subjects defined.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1">Code</th>
                      <th>Name</th>
                      <th>Sem.</th>
                      <th>Year</th>
                      <th>Coef.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.subjects.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-1 font-mono text-xs">{s.code}</td>
                        <td>{s.name}</td>
                        <td>{s.semester}</td>
                        <td>{s.yearLevel}</td>
                        <td>{s.coefficient}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
