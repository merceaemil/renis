import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify — RENIS-BI",
  description: "Public verification of diplomas and academic transcripts",
  robots: { index: true, follow: true },
};

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
