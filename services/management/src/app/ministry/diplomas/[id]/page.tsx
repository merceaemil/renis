"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";

type DiplomaDetail = {
  diploma: {
    id: string;
    status: string;
    uniqueCode: string | null;
    type: string;
    title: string;
    graduationYear: number;
    honors: string | null;
    submittedAt: string | null;
    publishedAt: string | null;
    hasPdf: boolean;
    institution: { name: string; code: string };
    student: {
      firstName: string;
      lastName: string;
      studentIdNumber: string;
      dateOfBirth: string | null;
    };
  };
  ministryFlags: { at: string; actorEmail: string | null; message?: string }[];
};

export default function MinistryDiplomaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<DiplomaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagMessage, setFlagMessage] = useState("");
  const [flagging, setFlagging] = useState(false);

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/ministry/diplomas/${id}`, { accessToken });
      if (!res.ok) {
        setError("Could not load diploma");
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
    const res = await apiFetch(`/api/ministry/diplomas/${id}/flag`, {
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

  if (loading) {
    return (
      <AppShell title="Diploma audit">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title="Diploma audit">
        <p className="text-red-700">{error ?? "Not found"}</p>
        <Link href="/ministry" className="text-renis-primary text-sm">
          ← Ministry overview
        </Link>
      </AppShell>
    );
  }

  const d = detail.diploma;

  return (
    <AppShell title={`${d.institution.name} — ${d.title}`}>
      <Link href="/ministry" className="text-sm text-renis-primary hover:underline">
        ← Ministry overview
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm space-y-2">
        <p>
          <span className="text-slate-500">Status:</span>{" "}
          <strong>{d.status}</strong>
        </p>
        <p>
          <span className="text-slate-500">Student:</span>{" "}
          {d.student.lastName}, {d.student.firstName} ({d.student.studentIdNumber})
        </p>
        <p>
          <span className="text-slate-500">Type:</span> {d.type} · {d.title}
        </p>
        <p>
          <span className="text-slate-500">Graduation year:</span> {d.graduationYear}
        </p>
        {d.uniqueCode && (
          <p>
            <span className="text-slate-500">Verification code:</span>{" "}
            <span className="font-mono text-xs">{d.uniqueCode}</span>
          </p>
        )}
        {d.submittedAt && (
          <p>
            <span className="text-slate-500">Submitted:</span>{" "}
            {new Date(d.submittedAt).toLocaleString()}
          </p>
        )}
        {d.publishedAt && (
          <p>
            <span className="text-slate-500">Published:</span>{" "}
            {new Date(d.publishedAt).toLocaleString()}
          </p>
        )}
        {(d.status === "SUBMITTED" || d.status === "PUBLISHED") && (
          <button
            type="button"
            className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => {
              if (!session?.accessToken) return;
              void downloadWithAuth(
                `/api/ministry/diplomas/${d.id}/preview`,
                session.accessToken,
                "diploma-audit.pdf",
                true
              );
            }}
          >
            Preview diploma PDF
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {(d.status === "SUBMITTED" || d.status === "PUBLISHED") && (
        <form
          onSubmit={submitFlag}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-800 mb-2">Flag anomaly</p>
          <textarea
            required
            minLength={10}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Describe the issue for the institution…"
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
      )}

      {detail.ministryFlags.length > 0 && (
        <div className="mt-6 text-sm">
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
    </AppShell>
  );
}
