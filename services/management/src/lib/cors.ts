import { NextResponse } from "next/server";

// Multiple origins are useful in dev: TYPO3 (renis.arxia.com) and the widget
// demo (widget.renis.arxia.com) both call management.renis.arxia.com/api/*.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isWildcard = allowedOrigins.includes("*");
const fallbackOrigin = allowedOrigins[0] ?? "*";

function applyCors(
  response: NextResponse,
  requestOrigin?: string | null
): NextResponse {
  const allow =
    isWildcard
      ? "*"
      : requestOrigin && allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : fallbackOrigin;
  response.headers.set("Access-Control-Allow-Origin", allow);
  response.headers.set("Vary", "Origin");
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
