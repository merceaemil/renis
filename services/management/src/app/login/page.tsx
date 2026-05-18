"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Authentication is misconfigured. In Docker set KEYCLOAK_ISSUER=http://localhost:8080/realms/renis and KEYCLOAK_INTERNAL_ISSUER=http://keycloak:8080/realms/renis, then rebuild management. Also verify AUTH_SECRET (32+ chars) and that Keycloak is running.",
  AccessDenied:
    "Access denied. Your Keycloak account is not linked to an active RENIS user. Run db-migrate and db:seed, or ask a Super Admin to create your account.",
  OAuthSignin: "Could not start Keycloak sign-in. Is Keycloak running on port 8080?",
  OAuthCallback:
    "Keycloak callback failed. Check client secret and redirect URI http://localhost:3000/*",
  Default: "Sign-in failed. Please try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-renis-primary to-slate-800 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-renis-primary">RENIS-BI</h1>
          <p className="mt-2 text-sm text-slate-600">
            National Register of Diplomas and Academic Transcripts
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}
          </div>
        )}

        <p className="mb-6 text-center text-sm text-slate-500">
          Sign-in for administrators only. Accounts are created by invitation
          from this application (Super Admin or Institution Admin).
        </p>
        <button
          type="button"
          onClick={() => signIn("keycloak", { callbackUrl })}
          className="w-full rounded-lg bg-renis-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Sign in with Keycloak
        </button>
        <p className="mt-3 text-center text-sm">
          <a
            href={`${process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/renis"}/login-actions/reset-credentials?client_id=${process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "renis-management"}`}
            className="text-renis-primary hover:underline"
          >
            Forgot password?
          </a>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">
          Dev: <code className="text-slate-600">super.admin@renis.bi</code> /
          Keycloak password from realm import
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
