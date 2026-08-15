"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSafeInternalPath } from "@/lib/safe-redirect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Password-based login. If a session already exists, proxy.ts (the
 * top-level Next.js middleware) redirects away from this page to
 * /dashboard before it ever renders — this page only has to handle
 * the sign-in itself.
 *
 * The sign-in call itself goes through our own backend
 * (POST /api/organization/login) rather than calling
 * supabase.auth.signInWithPassword directly — that's the only way to
 * put our own rate limiter in front of login attempts (see
 * loginRateLimiter/loginController). The session Supabase issues is
 * then handed to this browser's own Supabase client via setSession,
 * which persists it exactly the same way a direct client-side sign-in
 * would have.
 */
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/organization/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error || "Login failed");
        return;
      }

      const { session, user } = body.data;

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (setSessionError) {
        setError(setSessionError.message);
        return;
      }

      // Preserves where the user was trying to go (e.g. accepting a
      // team invitation) — validated as a same-origin relative path
      // only, never an external URL.
      const next = new URLSearchParams(window.location.search).get("next");
      const destination =
        next && isSafeInternalPath(next) ? next : "/dashboard";

      // Newly-provisioned team member accounts land on a "keep or
      // change your password" screen before doing anything else — see
      // organization/invitations.service.ts's createInvitation and
      // app/auth/set-password/page.tsx.
      if (user?.user_metadata?.must_change_password === true) {
        router.push(
          `/auth/set-password?next=${encodeURIComponent(destination)}`
        );
        return;
      }

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="text-3xl font-semibold text-foreground">
          Welcome back
        </h1>

        <p className="mt-2 text-muted-foreground">
          Log in to your Hostly PMS Pro account.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-foreground/80"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground/80"
              >
                Password
              </label>

              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-primary hover:opacity-80"
              >
                Forgot password?
              </Link>
            </div>

            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-primary hover:opacity-80"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
