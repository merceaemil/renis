"use client";

import { getSession } from "next-auth/react";
import { apiFetch } from "./api";

/** API fetch using the current session token; refetches session once on 401. */
export async function apiFetchSession(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await getSession();
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let res = await apiFetch(path, {
    ...init,
    accessToken: session.accessToken,
  });

  if (res.status === 401) {
    const retrySession = await getSession();
    if (
      retrySession?.accessToken &&
      retrySession.accessToken !== session.accessToken
    ) {
      res = await apiFetch(path, {
        ...init,
        accessToken: retrySession.accessToken,
      });
    }
  }

  return res;
}
