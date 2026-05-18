"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { InstitutionScopeBar } from "@/components/InstitutionScopeBar";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";

type Programme = { id: string; code: string; name: string };
type GradeSession = {
  id: string;
  academicYear: string;
  semester: string;
  status: string;
  submittedAt: string | null;
  programme: Programme;
  _count: { grades: number };
};

export default function GradesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<GradeSession[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scopeId, setScopeId] = useState("");
  const [form, setForm] = useState({
    programmeId: "",
    academicYear: "2024-2025",
    semester: "S1",
  });

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
      const [sRes, pRes] = await Promise.all([
        apiFetch(withInstitutionQuery("/api/grade-sessions", institutionId), {
          accessToken,
        }),
        apiFetch(withInstitutionQuery("/api/programmes", institutionId), {
          accessToken,
        }),
      ]);
      if (!sRes.ok) throw new Error("Could not load grade sessions");
      setSessions(await sRes.json());
      if (pRes.ok) setProgrammes(await pRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    const res = await apiFetch("/api/grade-sessions", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Creation failed");
      return;
    }
    setShowForm(false);
    router.push(`/institution/grades/${data.id}`);
  }

  return (
    <AppShell title="Grades & transcripts">
      <InstitutionScopeBar onChange={setScopeId} />
      <p className="mb-6 text-sm text-slate-600 max-w-2xl">
        Create a grade session (DRAFT), enter grades in the grid, then submit for
        ministry review. Semester averages are computed server-side (spec §4.3).
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="mb-6 rounded-lg bg-renis-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {showForm ? "Cancel" : "New grade session"}
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-3 max-w-3xl"
        >
          <label className="block text-sm md:col-span-3">
            <span className="text-slate-600">Programme</span>
            <select
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.programmeId}
              onChange={(e) => setForm({ ...form, programmeId: e.target.value })}
            >
              <option value="">— Select —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Academic year</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.academicYear}
              onChange={(e) =>
                setForm({ ...form, academicYear: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Semester</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            >
              <option value="S1">S1</option>
              <option value="S2">S2</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-renis-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Create session
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Semester</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Grades</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{s.programme.name}</td>
                  <td className="px-4 py-3">{s.academicYear}</td>
                  <td className="px-4 py-3">{s.semester}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.status === "SUBMITTED"
                          ? "text-green-700"
                          : "text-amber-700"
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{s._count.grades}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/institution/grades/${s.id}`}
                      className="text-renis-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
