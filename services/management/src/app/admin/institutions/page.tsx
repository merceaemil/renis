"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type Institution = { id: string; code: string; name: string; active: boolean };

export default function InstitutionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [list, setList] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken) void load(session.accessToken);
  }, [session?.accessToken]);

  async function load(token: string) {
    setLoading(true);
    try {
      const res = await apiFetch("/api/institutions", { accessToken: token });
      if (!res.ok) throw new Error("Could not load institutions");
      setList(await res.json());
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
    const res = await apiFetch("/api/institutions", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Create failed");
      return;
    }
    setForm({ code: "", name: "" });
    await load(session.accessToken);
  }

  return (
    <AppShell title="Institutions">
      <p className="text-sm text-slate-600 mb-6">
        Phase 1 covers universities and higher education institutions recognised by
        the Ministry.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg space-y-4"
      >
        <h2 className="font-medium text-slate-800">Add institution</h2>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Code</label>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="UB"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="University of Burundi"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-renis-primary px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Create
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono">{i.code}</td>
                  <td className="px-4 py-3">{i.name}</td>
                  <td className="px-4 py-3">{i.active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/institutions/${i.id}/settings`}
                      className="text-renis-primary hover:underline text-sm"
                    >
                      Settings
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
