"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowMenu } from "@/components/ui/RowMenu";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";

type Institution = { id: string; code: string; name: string; active: boolean };

export default function InstitutionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Institution | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const res = await apiFetch(listApiUrl("/api/institutions", page, pageSize), {
        accessToken: session.accessToken,
      });
      if (!res.ok) throw new Error("Could not load institutions");
      return normalizeListResponse<Institution>(await res.json());
    },
    [session?.accessToken]
  );

  const {
    items: list,
    loading,
    error: listError,
    setError: setListError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    reload,
  } = usePaginatedList(fetchPage, [session?.accessToken]);

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
    setCreateOpen(false);
    setForm({ code: "", name: "" });
    await reload();
  }

  return (
    <AppShell title="Institutions">
      <PageHeader
        description="Phase 1 covers universities and higher education institutions recognised by the Ministry."
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            Add institution
          </button>
        }
      />

      {(error ?? listError) ? (
        <Alert variant="error" onDismiss={() => { setError(null); setListError(null); }}>
          {error ?? listError}
        </Alert>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add institution"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" form="institution-create-form" className="renis-btn-primary">
              Create
            </button>
          </div>
        }
      >
        <form id="institution-create-form" className="space-y-4" onSubmit={handleCreate}>
          <label className="block text-sm">
            <span className="text-slate-600">Code</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="renis-input mt-1"
              placeholder="UB"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="renis-input mt-1"
              placeholder="University of Burundi"
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.name ?? "Institution"}
        description={detailTarget ? `Code: ${detailTarget.code}` : undefined}
        footer={
          detailTarget ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="renis-btn-secondary"
                onClick={() => setDetailTarget(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="renis-btn-primary"
                onClick={() =>
                  router.push(`/admin/institutions/${detailTarget.id}/settings`)
                }
              >
                Open settings
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Code</dt>
              <dd className="font-mono text-slate-900">{detailTarget.code}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge
                  status={detailTarget.active ? "ACTIVE" : "INACTIVE"}
                  label={detailTarget.active ? "Active" : "Inactive"}
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No institutions yet. Add one to get started.
        </div>
      ) : (
        <PaginatedTable
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr
                  key={i.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(i)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{i.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{i.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={i.active ? "ACTIVE" : "INACTIVE"}
                      label={i.active ? "Active" : "Inactive"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={`Actions for ${i.code}`}
                      items={[
                        {
                          label: "View details",
                          onClick: () => setDetailTarget(i),
                        },
                        {
                          label: "Settings",
                          onClick: () =>
                            router.push(`/admin/institutions/${i.id}/settings`),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PaginatedTable>
      )}
    </AppShell>
  );
}
