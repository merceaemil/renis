import Link from "next/link";
import type { ReactNode } from "react";

export function VerifyPageShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-renis-primary via-slate-800 to-slate-900">
      <header className="px-4 pt-8 pb-4 text-center text-white">
        <p className="text-xs font-medium uppercase tracking-widest text-renis-accent">
          Republic of Burundi
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          RENIS-BI
        </h1>
        <p className="mt-1 text-sm text-slate-300 max-w-md mx-auto">
          {subtitle ??
            "National Register of Diplomas and Academic Transcripts — public verification"}
        </p>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl ring-1 ring-slate-200/80">
          {children}
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-slate-400">
        <p>Ministry of National Education — official verification service</p>
        <p className="mt-2">
          <Link href="/verify" className="text-renis-accent hover:underline">
            Verify another code
          </Link>
          {" · "}
          <Link href="/login" className="text-slate-400 hover:text-white">
            Administrator sign-in
          </Link>
        </p>
      </footer>
    </div>
  );
}
