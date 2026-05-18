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
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  const [message, setMessage] = useState<string | null>(null);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagMessage, setFlagMessage] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(true);

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
    setFlagOpen(false);
    setMessage("Flag sent to the institution.");
    await load(session.accessToken);
  }

  async function previewPdf() {
    if (!session?.accessToken || !detail) return;
    try {
      await downloadWithAuth(
        `/api/ministry/diplomas/${detail.diploma.id}/preview`,
        session.accessToken,
        "diploma-audit.pdf",
        true
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  if (loading) {
    return (
      <AppShell title="Diploma audit">
        <p className="text-slate-500 py-8">Loading…</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title="Diploma audit">
        <Alert variant="error">{error ?? "Diploma not found"}</Alert>
        <Link href="/ministry" className="text-sm text-renis-primary hover:underline">
          ← Ministry overview
        </Link>
      </AppShell>
    );
  }

  const d = detail.diploma;
  const canFlag = d.status === "SUBMITTED" || d.status === "PUBLISHED";
  const canPreview = canFlag;
  const verifyHref = d.uniqueCode ? `/verify/${d.uniqueCode}` : null;

  return (
    <AppShell title={`${d.institution.name} — ${d.title}`}>
      <div className="mb-4">
        <Link href="/ministry" className="text-sm text-renis-primary hover:underline">
          ← Ministry overview
        </Link>
      </div>

      <PageHeader
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status} />
            <span>{d.institution.code} · read-only audit</span>
          </span>
        }
        actions={
          <>
            {canPreview && (
              <button type="button" className="renis-btn-secondary" onClick={() => void previewPdf()}>
                Preview PDF
              </button>
            )}
            {verifyHref && (
              <Link href={verifyHref} target="_blank" className="renis-btn-secondary">
                Public verify page
              </Link>
            )}
            {canFlag && (
              <button type="button" className="renis-btn-primary" onClick={() => setFlagOpen(true)}>
                Flag anomaly
              </button>
            )}
          </>
        }
      />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}
      {message ? (
        <Alert variant="success" onDismiss={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      <Modal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title="Flag anomaly"
        description="Describe the issue for the institution (minimum 10 characters)."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setFlagOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="diploma-flag-form"
              disabled={flagging || flagMessage.trim().length < 10}
              className="renis-btn-primary disabled:opacity-50"
            >
              {flagging ? "Sending…" : "Send flag"}
            </button>
          </div>
        }
      >
        <form id="diploma-flag-form" onSubmit={submitFlag}>
          <textarea
            required
            minLength={10}
            rows={4}
            className="renis-input w-full"
            placeholder="Describe the issue…"
            value={flagMessage}
            onChange={(e) => setFlagMessage(e.target.value)}
          />
        </form>
      </Modal>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-500 mb-4">Diploma record</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {d.student.lastName}, {d.student.firstName}
            </dd>
            <dd className="font-mono text-xs text-slate-500 mt-0.5">
              {d.student.studentIdNumber}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Date of birth</dt>
            <dd className="text-slate-900 mt-0.5">
              {d.student.dateOfBirth
                ? new Date(d.student.dateOfBirth).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Type & title</dt>
            <dd className="text-slate-900 mt-0.5">
              {d.type} · {d.title}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Graduation year</dt>
            <dd className="text-slate-900 mt-0.5">{d.graduationYear}</dd>
          </div>
          {d.honors ? (
            <div>
              <dt className="text-slate-500">Honors</dt>
              <dd className="text-slate-900 mt-0.5">{d.honors}</dd>
            </div>
          ) : null}
          {d.uniqueCode ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Verification code</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-3">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono">
                  {d.uniqueCode}
                </code>
                {verifyHref ? (
                  <Link href={verifyHref} target="_blank" className="text-renis-primary text-sm hover:underline">
                    Open verify page ↗
                  </Link>
                ) : null}
              </dd>
            </div>
          ) : null}
          {d.submittedAt ? (
            <div>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="text-slate-900 mt-0.5">
                {new Date(d.submittedAt).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {d.publishedAt ? (
            <div>
              <dt className="text-slate-500">Published</dt>
              <dd className="text-slate-900 mt-0.5">
                {new Date(d.publishedAt).toLocaleString()}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-slate-500">Archived PDF</dt>
            <dd className="text-slate-900 mt-0.5">{d.hasPdf ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </div>

      {detail.ministryFlags.length > 0 && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => setFlagsOpen((o) => !o)}
          >
            Previous ministry flags ({detail.ministryFlags.length})
            <span className="text-slate-400">{flagsOpen ? "▾" : "▸"}</span>
          </button>
          {flagsOpen && (
            <ul className="border-t border-slate-100 px-4 pb-4 space-y-2 text-sm">
              {detail.ministryFlags.map((f, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="text-xs text-slate-500">
                    {new Date(f.at).toLocaleString()} — {f.actorEmail ?? "—"}
                  </span>
                  <p className="mt-1 text-slate-800">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}
