"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface InvitationPreview {
  organizationName: string;
  email: string;
  role: "member" | "company_admin";
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

type PageStatus =
  | "loading"
  | "missingToken"
  | "previewError"
  | "ready"
  | "accepting"
  | "success"
  | "acceptError";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * The invitation preview must be reachable before the visitor has a
 * session at all (that's the whole point — showing "you've been
 * invited" before asking them to log in), so this can't go through
 * lib/api.ts's apiFetch, which unconditionally requires an existing
 * session and throws otherwise.
 */
async function fetchInvitationPreview(
  token: string
): Promise<InvitationPreview> {
  const response = await fetch(
    `${API_URL}/api/organization/invitations/${encodeURIComponent(token)}`
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || "This invitation could not be found.");
  }

  return body.data;
}

function formatRole(role: string) {
  return role === "company_admin" ? "Company Admin" : "Member";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AcceptInvitationPage() {
  const router = useRouter();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState("");
  const [acceptErrorMessage, setAcceptErrorMessage] = useState("");

  // undefined = still checking; null = unauthenticated; string = the
  // authenticated session's email.
  const [sessionEmail, setSessionEmail] = useState<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    setToken(tokenParam);

    if (!tokenParam) {
      setStatus("missingToken");
      return;
    }

    let cancelled = false;

    async function load(currentToken: string) {
      try {
        const data = await fetchInvitationPreview(currentToken);
        if (cancelled) return;
        setPreview(data);

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;
        setSessionEmail(session?.user?.email?.toLowerCase() ?? null);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setPreviewErrorMessage(
          err instanceof Error
            ? err.message
            : "This invitation could not be found."
        );
        setStatus("previewError");
      }
    }

    load(tokenParam);

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    if (!token) return;

    setStatus("accepting");
    setAcceptErrorMessage("");

    try {
      await apiFetch("/api/organization/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      setStatus("success");
      router.replace("/dashboard");
    } catch (err) {
      setAcceptErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to accept this invitation. Please try again."
      );
      setStatus("acceptError");
    }
  }

  async function handleSignOutAndSwitch() {
    const supabase = createClient();
    await supabase.auth.signOut();

    const next = token
      ? `/auth/login?next=${encodeURIComponent(
          `/invitations/accept?token=${token}`
        )}`
      : "/auth/login";

    router.push(next);
  }

  const loginHref = token
    ? `/auth/login?next=${encodeURIComponent(
        `/invitations/accept?token=${token}`
      )}`
    : "/auth/login";

  const emailMismatch =
    preview &&
    sessionEmail !== undefined &&
    sessionEmail !== null &&
    sessionEmail !== preview.email.toLowerCase();

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

        {status === "loading" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              Checking invitation...
            </h1>
            <p className="mt-3 text-slate-500">Please wait a moment.</p>
          </>
        )}

        {status === "previewError" && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              Unable to load invitation
            </h1>
            <p className="mt-3 text-red-600">{previewErrorMessage}</p>
          </>
        )}

        {preview && (status === "ready" || status === "accepting" || status === "acceptError") && (
          <>
            <h1 className="text-2xl font-semibold text-slate-950">
              You&apos;ve been invited
            </h1>

            <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-5 text-left text-sm">
              <p>
                <span className="text-slate-500">Organization:</span>{" "}
                <span className="font-medium text-slate-900">
                  {preview.organizationName}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Invited email:</span>{" "}
                <span className="font-medium text-slate-900">
                  {preview.email}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Role:</span>{" "}
                <span className="font-medium text-slate-900">
                  {formatRole(preview.role)}
                </span>
              </p>
              {preview.status === "pending" && (
                <p>
                  <span className="text-slate-500">Expires:</span>{" "}
                  <span className="font-medium text-slate-900">
                    {formatDate(preview.expiresAt)}
                  </span>
                </p>
              )}
            </div>

            {preview.status === "accepted" && (
              <p className="mt-5 text-slate-600">
                This invitation has already been accepted.
              </p>
            )}

            {preview.status === "revoked" && (
              <p className="mt-5 text-slate-600">
                This invitation is no longer valid.
              </p>
            )}

            {preview.status === "expired" && (
              <p className="mt-5 text-slate-600">
                This invitation has expired.
              </p>
            )}

            {preview.status === "pending" && sessionEmail === null && (
              <>
                <p className="mt-5 text-slate-500">
                  Log in with the email this invitation was sent to,
                  and you&apos;ll be brought right back here to accept
                  it.
                </p>
                <Link
                  href={loginHref}
                  className="mt-5 inline-block rounded-lg bg-[#10172a] px-5 py-3 text-white hover:bg-[#18213a]"
                >
                  Log in to accept
                </Link>
              </>
            )}

            {preview.status === "pending" && emailMismatch && (
              <>
                <p className="mt-5 text-red-600">
                  This invitation was sent to another email address.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  You&apos;re currently signed in with a different
                  account. Sign out and sign in with{" "}
                  <strong>{preview.email}</strong> to accept it.
                </p>
                <button
                  onClick={handleSignOutAndSwitch}
                  className="mt-5 rounded-lg border border-slate-200 px-5 py-3 text-slate-700 hover:bg-slate-50"
                >
                  Sign out and use a different account
                </button>
              </>
            )}

            {preview.status === "pending" &&
              sessionEmail !== undefined &&
              sessionEmail !== null &&
              !emailMismatch && (
                <>
                  {acceptErrorMessage && (
                    <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {acceptErrorMessage}
                    </p>
                  )}

                  <button
                    onClick={handleAccept}
                    disabled={status === "accepting"}
                    className="mt-5 w-full rounded-lg bg-[#10172a] px-5 py-3 text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "accepting"
                      ? "Accepting..."
                      : "Accept Invitation"}
                  </button>
                </>
              )}
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
      </div>
    </main>
  );
}
