"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canViewAuditLog } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { AuditActionBadge } from "@/components/ui/AuditActionBadge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { RowMenu } from "@/components/ui/RowMenu";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
  auditFiltersToSearchParams,
  type AuditLogFilters,
} from "@/lib/audit-log-query";
import { formatAuditMetadata } from "@/lib/audit-action-style";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";
import { useT } from "@/lib/i18n/LocaleProvider";

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: unknown;
};

const EMPTY_FILTERS: AuditLogFilters = {
  action: "",
  actionContains: "",
  entityType: "",
  actor: "",
  entityId: "",
  from: "",
  to: "",
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button,a,[role=menu],select,input,label"));
}

function countActiveFilters(filters: AuditLogFilters) {
  return Object.values(filters).filter((v) => v && String(v).trim()).length;
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [draft, setDraft] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [meta, setMeta] = useState<{ actions: string[]; entityTypes: string[] }>({
    actions: [],
    entityTypes: [],
  });

  useEffect(() => {
    if (session && !canViewAuditLog(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void apiFetch("/api/audit-logs/meta", {
      accessToken: session.accessToken,
    }).then(async (res) => {
      if (res.ok) setMeta(await res.json());
    });
  }, [session?.accessToken]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const url = listApiUrl(
        "/api/audit-logs",
        page,
        pageSize,
        auditFiltersToSearchParams(applied)
      );
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error(t("audit.couldNotLoad"));
      return normalizeListResponse<AuditRow>(await res.json());
    },
    [session?.accessToken, applied]
  );

  const {
    items: logs,
    loading,
    error,
    setError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
  } = usePaginatedList(fetchPage, [session?.accessToken, applied]);

  function applyFilters() {
    setApplied({ ...draft });
    setPage(1);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const activeFilterCount = countActiveFilters(applied);

  return (
    <AppShell title={t("audit.title")}>
      <PageHeader description={t("audit.description")} />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <span>
            {t("audit.filters")}
            {activeFilterCount > 0 ? (
              <span className="ml-2 rounded-full bg-renis-primary/10 px-2 py-0.5 text-xs text-renis-primary">
                {t("audit.filtersActive", { count: activeFilterCount })}
              </span>
            ) : null}
          </span>
          <span className="text-slate-400">{filtersOpen ? "▾" : "▸"}</span>
        </button>

        {filtersOpen ? (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="text-slate-600">
                  {t("audit.filter.action")}
                </span>
                <select
                  className="renis-input mt-1"
                  value={draft.action ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, action: e.target.value, actionContains: "" })
                  }
                >
                  <option value="">{t("audit.filter.actionAll")}</option>
                  {meta.actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">
                  {t("audit.filter.actionContains")}
                </span>
                <input
                  type="search"
                  className="renis-input mt-1 font-mono text-xs"
                  placeholder={t("audit.filter.actionContainsPlaceholder")}
                  value={draft.actionContains ?? ""}
                  disabled={Boolean(draft.action)}
                  onChange={(e) =>
                    setDraft({ ...draft, actionContains: e.target.value, action: "" })
                  }
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">
                  {t("audit.filter.entityType")}
                </span>
                <select
                  className="renis-input mt-1"
                  value={draft.entityType ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, entityType: e.target.value })
                  }
                >
                  <option value="">{t("audit.filter.entityTypeAll")}</option>
                  {meta.entityTypes.map((typeName) => (
                    <option key={typeName} value={typeName}>
                      {typeName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">
                  {t("audit.filter.actor")}
                </span>
                <input
                  type="search"
                  className="renis-input mt-1"
                  placeholder={t("audit.filter.contains")}
                  value={draft.actor ?? ""}
                  onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">
                  {t("audit.filter.entityId")}
                </span>
                <input
                  type="search"
                  className="renis-input mt-1 font-mono text-xs"
                  placeholder={t("audit.filter.uuidPrefix")}
                  value={draft.entityId ?? ""}
                  onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">{t("audit.filter.from")}</span>
                <input
                  type="date"
                  className="renis-input mt-1"
                  value={draft.from ?? ""}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">{t("audit.filter.to")}</span>
                <input
                  type="date"
                  className="renis-input mt-1"
                  value={draft.to ?? ""}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="renis-btn-primary" onClick={applyFilters}>
                {t("audit.filter.apply")}
              </button>
              <button type="button" className="renis-btn-secondary" onClick={clearFilters}>
                {t("audit.filter.clear")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t("audit.entry.title")}
        description={detail ? new Date(detail.createdAt).toLocaleString() : undefined}
        size="lg"
        footer={
          detail ? (
            <div className="flex flex-wrap justify-end gap-2">
              {detail.entityId ? (
                <button
                  type="button"
                  className="renis-btn-secondary"
                  onClick={() => void copyText(detail.entityId!)}
                >
                  {t("audit.entry.copyEntityId")}
                </button>
              ) : null}
              <button type="button" className="renis-btn-secondary" onClick={() => setDetail(null)}>
                {t("common.close")}
              </button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">{t("audit.entry.action")}</p>
              <AuditActionBadge action={detail.action} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{t("audit.entry.actor")}</dt>
                <dd className="text-slate-900 mt-0.5">
                  {detail.actorEmail ?? t("common.dash")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("audit.entry.ipAddress")}
                </dt>
                <dd className="font-mono text-xs text-slate-900 mt-0.5">
                  {detail.ipAddress ?? t("common.dash")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("audit.entry.entityType")}
                </dt>
                <dd className="text-slate-900 mt-0.5">
                  {detail.entityType ?? t("common.dash")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t("audit.entry.entityId")}</dt>
                <dd className="font-mono text-xs text-slate-900 mt-0.5 break-all">
                  {detail.entityId ?? t("common.dash")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t("audit.entry.entryId")}</dt>
                <dd className="font-mono text-xs text-slate-500 mt-0.5 break-all">
                  {detail.id}
                </dd>
              </div>
            </dl>
            {detail.metadata !== null && detail.metadata !== undefined ? (
              <div>
                <p className="text-slate-500 mb-2">
                  {t("audit.entry.metadata")}
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                  {formatAuditMetadata(detail.metadata)}
                </pre>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                {t("audit.entry.noMetadata")}
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("audit.empty")}
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
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">{t("audit.column.time")}</th>
                <th className="px-3 py-2 font-medium">
                  {t("audit.column.action")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("audit.column.actor")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("audit.column.entity")}
                </th>
                <th className="px-3 py-2 font-medium">{t("audit.column.ip")}</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr
                  key={row.id}
                  className="renis-table-row border-t border-slate-100"
                  onClick={(e) => {
                    if (isInteractiveTarget(e.target)) return;
                    setDetail(row);
                  }}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <AuditActionBadge action={row.action} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.actorEmail ?? t("common.dash")}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {row.entityType ?? t("common.dash")}
                    {row.entityId ? (
                      <span className="block font-mono text-[10px] text-slate-400 truncate max-w-[10rem]">
                        {row.entityId}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">
                    {row.ipAddress ?? t("common.dash")}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={t("audit.entryActions")}
                      items={[
                        {
                          label: t("common.viewDetails"),
                          onClick: () => setDetail(row),
                        },
                        ...(row.entityId
                          ? [
                              {
                                label: t("audit.entry.copyEntityId"),
                                onClick: () => void copyText(row.entityId!),
                              },
                            ]
                          : []),
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
