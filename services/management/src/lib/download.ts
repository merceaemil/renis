/** Authenticated file download (Bearer token). */
export async function downloadWithAuth(
  path: string,
  accessToken: string,
  filename: string,
  openInline = false
) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (openInline) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
