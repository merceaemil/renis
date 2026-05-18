import { NextResponse } from "next/server";

const origin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

export function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

export function corsOptions() {
  return withCors(new NextResponse(null, { status: 204 }));
}
