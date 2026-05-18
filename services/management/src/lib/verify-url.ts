/** QR codes on diplomas and transcripts always point at the management public verify page. */
export function buildDiplomaVerifyUrl(code: string): string {
  const base = (
    process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${base}/verify/${encodeURIComponent(code)}`;
}
