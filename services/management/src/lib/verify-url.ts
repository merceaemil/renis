/**
 * QR codes on diplomas and transcripts always point at the management public
 * verify page. MANAGEMENT_PUBLIC_URL is a server-only env var (not NEXT_PUBLIC_*),
 * so on the client we fall back to the current window origin — which is exactly
 * where the user is browsing the management app.
 */
export function buildDiplomaVerifyUrl(code: string): string {
  const fromEnv = process.env.MANAGEMENT_PUBLIC_URL;
  const fromWindow =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const base = (fromEnv ?? fromWindow ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  return `${base}/verify/${encodeURIComponent(code)}`;
}
