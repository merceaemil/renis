import { NextResponse } from "next/server";

const origin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

function applyCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.append(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept-Language, Authorization"
  );
  response.headers.append(
    "Access-Control-Expose-Headers",
    "Content-Language"
  );
  return response;
}

/**
 * Adds permissive CORS headers to a `NextResponse`. Accepts a Promise so
 * helpers like `unauthorized()` / `forbidden()` can be locale-aware without
 * every call-site having to `await` them.
 */
export function withCors(
  response: NextResponse | Promise<NextResponse>
): NextResponse | Promise<NextResponse> {
  if (response instanceof Promise) {
    return response.then(applyCors);
  }
  return applyCors(response);
}

export function corsOptions() {
  return applyCors(new NextResponse(null, { status: 204 }));
}
