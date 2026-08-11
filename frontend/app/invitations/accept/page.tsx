"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type Status =
  | "checking"
  | "needsAuth"
  | "accepting"
  | "success"
  | "error"
  | "missingToken";

export default function AcceptInvitationPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    setToken(tokenParam);

    if (!tokenParam) {
      setStatus("missingToken");
      return;
    }

    let cancelled = false;

    async function checkAuthAndAccept(currentToken: string) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setStatus("needsAuth");
        return;
      }

      setStatus("accepting");

      try {
        await apiFetch("/api/organization/invitations/accept", {
          method: "POST",
          body: JSON.stringify({ token: currentToken }),
        });

        if (cancelled) return;

        setStatus("success");
        router.replace("/dashboard");
      } catch (err) {
        if (cancelled) return;

        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Unable to accept this invitation. Please try again."
        );
        setStatus("error");
      }
    }

    checkAuthAndAccept(tokenParam);

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loginHref = token
    ? `/auth/login?next=${encodeURIComponent(
        `/invitations/accept?token=${token}`
      )}`
    : "/auth/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status === "missingToken" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              Invalid invitation link
            </h1>
            <p className="mt-3 text-slate-500">
              This link is missing its invitation code. Please use the
              link from your invitation email.
            </p>
          </>
        )}

        {(status === "checking" || status === "accepting") && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              {status === "checking"
                ? "Checking invitation..."
                : "Accepting invitation..."}
            </h1>
            <p className="mt-3 text-slate-500">
              Please wait a moment.
            </p>
          </>
        )}

        {status === "needsAuth" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              You&apos;ve been invited
            </h1>
            <p className="mt-3 text-slate-500">
              Log in with the email this invitation was sent to, and
              you&apos;ll be brought right back here to accept it.
            </p>
            <Link
              href={loginHref}
              className="mt-6 inline-block rounded-lg bg-[#10172a] px-5 py-3 text-white hover:bg-[#18213a]"
            >
              Log in to accept
            </Link>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              Invitation accepted
            </h1>
            <p className="mt-3 text-slate-500">
              Taking you to your dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              Unable to accept invitation
            </h1>
            <p className="mt-3 text-red-600">{errorMessage}</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg border border-slate-200 px-5 py-3 text-slate-700 hover:bg-slate-50"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
