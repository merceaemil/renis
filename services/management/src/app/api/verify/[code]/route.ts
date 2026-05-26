import { NextRequest, NextResponse } from "next/server";
import { tApi } from "@renis/core";
import { lookupVerification } from "@/lib/verify-lookup";
import { resolveLocaleFromRequest } from "@/lib/i18n/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept-Language, Authorization",
};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.trim();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const locale = resolveLocaleFromRequest(req);

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const url = new URL(
      `/verify/${encodeURIComponent(code)}`,
      req.nextUrl.origin
    );
    return NextResponse.redirect(url, { headers: corsHeaders });
  }

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: tApi("api.error.tooManyRequests", locale) },
      { status: 429, headers: corsHeaders }
    );
  }

  const result = await lookupVerification(rawCode, { ip, locale });
  return NextResponse.json(result, {
    headers: { ...corsHeaders, "Content-Language": locale },
  });
}
