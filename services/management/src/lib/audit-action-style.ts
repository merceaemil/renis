/** Visual grouping for audit action codes in the UI. */
export function auditActionTone(action: string): string {
  if (action.startsWith("USER_") || action.includes("LOGIN") || action.includes("LOGOUT")) {
    return "bg-violet-50 text-violet-800 ring-violet-200";
  }
  if (action.startsWith("DIPLOMA_") || action.startsWith("PUBLIC_DIPLOMA")) {
    return "bg-sky-50 text-sky-800 ring-sky-200";
  }
  if (
    action.startsWith("GRADE") ||
    action.includes("GRADES_") ||
    action.startsWith("PUBLIC_TRANSCRIPT")
  ) {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  if (action.includes("ANOMALY") || action.includes("FLAGGED")) {
    return "bg-red-50 text-red-800 ring-red-200";
  }
  if (action.startsWith("INSTITUTION_") || action.startsWith("PROGRAMME_")) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (action.startsWith("STUDENT_")) {
    return "bg-teal-50 text-teal-800 ring-teal-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function formatAuditMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}
