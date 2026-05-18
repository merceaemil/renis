export function withInstitutionQuery(
  path: string,
  institutionId?: string
): string {
  if (!institutionId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}institutionId=${encodeURIComponent(institutionId)}`;
}
