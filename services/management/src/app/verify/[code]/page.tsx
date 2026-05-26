import { headers } from "next/headers";
import { VerifyPageShell } from "@/components/VerifyPageShell";
import { VerifyResultCard } from "@/components/VerifyResultCard";
import { lookupVerification } from "@/lib/verify-lookup";
import { getServerLocale } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function VerifyCodePage({
  params,
  searchParams,
}: PageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).trim();
  const sp = await searchParams;
  const locale = await getServerLocale({ lang: sp?.lang });

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    undefined;

  const result = await lookupVerification(code, { ip, locale });

  return (
    <VerifyPageShell>
      <VerifyResultCard result={result} code={code} />
    </VerifyPageShell>
  );
}
