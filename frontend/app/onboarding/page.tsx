"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type CheckStatus = "checking" | "ready" | "redirecting";

export default function OnboardingPage() {
  const router = useRouter();

  const [checkStatus, setCheckStatus] = useState<CheckStatus>("checking");

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Authoritative check: does this user already have an organization?
  // Prevents both "authenticated users with an org seeing onboarding"
  // and (combined with the backend's own check) refreshing this page
  // after already creating a workspace from creating a second one.
  useEffect(() => {
    let cancelled = false;

    async function checkOrganization() {
      try {
        await apiFetch("/api/organization/me");

        if (!cancelled) {
          setCheckStatus("redirecting");
          router.replace("/dashboard");
        }
      } catch {
        // 403 "not a member of an organization" is the expected,
        // normal case here — show the form. Any other failure (401,
        // network) also falls through to the form; the form's own
        // submit will surface a clear error if something is
        // genuinely wrong rather than silently trapping the user.
        if (!cancelled) {
          setCheckStatus("ready");
        }
      }
    }

    checkOrganization();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter your organization name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiFetch("/api/organization", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          country: country.trim() || undefined,
          timezone: timezone.trim() || undefined,
        }),
      });

      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your workspace. Please try again."
      );
      setSaving(false);
    }
  }

  if (checkStatus !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-950">
          Welcome to Hostly PMS Pro
        </h1>

        <p className="mt-2 text-slate-500">Let&apos;s set up your workspace.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="orgName"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Organization / Company name
            </label>

            <input
              id="orgName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Properties"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="country"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Country <span className="text-slate-400">(optional)</span>
              </label>

              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Timezone <span className="text-slate-400">(optional)</span>
              </label>

              <input
                id="timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-[#10172a] px-4 py-3 text-white hover:bg-[#18213a] disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
