"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSafeInternalPath } from "@/lib/safe-redirect";

type CheckStatus = "checking" | "choice" | "form" | "noSession";

/**
 * Lands two different visitors here:
 * 1. A team member whose account was created with an assigned
 *    temporary password (must_change_password metadata) — the login
 *    page redirects them here before letting them reach the
 *    dashboard. This is the only case where "keep the password you
 *    were emailed" is a real, safe choice — see the `choice` screen
 *    below — since they already have a password that works.
 * 2. An existing (pre-password-auth) account holder who clicked the
 *    one-time "set your password" migration email — that's a
 *    Supabase recovery link, which establishes a session on this
 *    page automatically via the URL's recovery token before this
 *    component even renders its check. They never had a password at
 *    all, so there's nothing to "keep" — they go straight to the
 *    form.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<CheckStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function destinationPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && isSafeInternalPath(next) ? next : "/dashboard";
  }

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setStatus("noSession");
        return;
      }

      setStatus(
        session.user.user_metadata?.must_change_password === true
          ? "choice"
          : "form"
      );
    }

    checkSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function keepCurrentPassword() {
    setSubmitting(true);
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { must_change_password: false },
      });

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }

      router.push(destinationPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push(destinationPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (status === "noSession") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            This link has expired
          </h1>
          <p className="mt-3 text-muted-foreground">
            Please log in, or request a new password-setup link.
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white hover:opacity-90"
          >
            Go to login
          </button>
        </div>
      </main>
    );
  }

  if (status === "choice") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8">
          <h1 className="text-3xl font-semibold text-foreground">
            Welcome to Hostly PMS Pro
          </h1>

          <p className="mt-2 text-muted-foreground">
            You logged in with the temporary password you were emailed. Keep
            using it, or set your own now — either way you&apos;re covered.
          </p>

          {error && (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-8 space-y-3">
            <button
              onClick={keepCurrentPassword}
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Continuing..." : "Keep my current password"}
            </button>

            <button
              onClick={() => setStatus("form")}
              disabled={submitting}
              className="w-full rounded-lg border border-border px-4 py-3 text-foreground/80 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Set a new password instead
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="text-3xl font-semibold text-foreground">
          Set your password
        </h1>

        <p className="mt-2 text-muted-foreground">
          Choose a password for your Hostly PMS Pro account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-foreground/80"
            >
              New password
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-foreground/80"
            >
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Set password"}
          </button>
        </form>
      </div>
    </main>
  );
}
