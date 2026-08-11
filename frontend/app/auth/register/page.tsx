"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "sent" | "error";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const supabase = createClient();

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setStatus("error");
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!trimmedEmail) {
      setStatus("error");
      setErrorMessage("Please enter your email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      /*
       * This app authenticates exclusively via Supabase magic links
       * (see app/auth/login/page.tsx) — there is no password-based
       * signup anywhere in the system, and adding one here would be a
       * second, incompatible auth mechanism. "Registration" for a
       * brand-new email is the same signInWithOtp call login uses,
       * with shouldCreateUser made explicit and the full name carried
       * as user metadata so it's available once the account exists.
       * An existing user entering their email here simply signs them
       * in, which is the correct and expected behavior for a
       * passwordless system.
       */
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again."
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-950">
          Create your account
        </h1>

        <p className="mt-2 text-slate-500">
          Enter your details and we&apos;ll send you a secure link to get
          started — no password needed.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm">
              We sent a confirmation link to <strong>{email.trim()}</strong>.
              Open it to finish creating your account — you&apos;ll be
              guided through setting up your workspace next.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Full name
              </label>

              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
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
                className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            {status === "error" && errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
            >
              {status === "loading" ? "Sending..." : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-slate-900 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
