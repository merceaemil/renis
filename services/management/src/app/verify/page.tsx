import { redirect } from "next/navigation";
import { VerifyPageShell } from "@/components/VerifyPageShell";
import { VerifySearchForm } from "@/components/VerifySearchForm";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function VerifySearchPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const trimmed = code?.trim();

  if (trimmed) {
    redirect(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <VerifyPageShell>
      <VerifySearchForm />
    </VerifyPageShell>
  );
}
