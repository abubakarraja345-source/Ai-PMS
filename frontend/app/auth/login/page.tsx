"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSafeInternalPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      // Preserves where the user was trying to go (e.g. accepting a
      // team invitation) across the magic-link email round trip.
      // Validated again on the way back in app/auth/callback/route.ts
      // — this is only ever a same-origin relative path, never an
      // external URL.
      const next = new URLSearchParams(window.location.search).get(
        "next"
      );

      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin
      );

      if (next && isSafeInternalPath(next)) {
        redirectTo.searchParams.set("next", next);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo.toString(),
        },
      });

      if (error) {
        setMessage(`❌ ${error.message}`);
        return;
      }

      setMessage("✅ Check your email. We sent you a Magic Link.");
    } catch (error) {
      setMessage(
        error instanceof Error ? `❌ ${error.message}` : "❌ Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-8">
        <h1 className="text-3xl font-semibold">Welcome back</h1>

        <p className="mt-2 text-gray-500">
          Enter your email to receive a secure login link.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border px-4 py-3 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {message && (
          <p className="mt-5 text-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}