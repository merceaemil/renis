/** Same-origin REST calls (management app hosts `/api/*`). */
export async function apiFetch(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  const url = path.startsWith("/") ? path : `/${path}`;
  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}
