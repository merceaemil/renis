import { headers } from "next/headers";
import { VerifyPageShell } from "@/components/VerifyPageShell";
import { VerifyResultCard } from "@/components/VerifyResultCard";
import { lookupVerification } from "@/lib/verify-lookup";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function VerifyCodePage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).trim();

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    undefined;

  const result = await lookupVerification(code, { ip });

  return (
    <VerifyPageShell>
      <VerifyResultCard result={result} code={code} />
    </VerifyPageShell>
  );
}
