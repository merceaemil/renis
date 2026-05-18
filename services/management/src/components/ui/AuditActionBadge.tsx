import { auditActionTone } from "@/lib/audit-action-style";

export function AuditActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex max-w-[14rem] truncate rounded-full px-2.5 py-0.5 text-xs font-medium font-mono ring-1 ring-inset ${auditActionTone(action)}`}
      title={action}
    >
      {action}
    </span>
  );
}
