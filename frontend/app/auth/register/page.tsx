"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "condo", label: "Condo" },
  { value: "studio", label: "Studio" },
  { value: "hotel", label: "Hotel" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "other", label: "Other" },
] as const;

const REFERRAL_SOURCE_OPTIONS = [
  { value: "search_engine", label: "Search engine" },
  { value: "social_media", label: "Social media" },
  { value: "referral", label: "Referral from a friend/colleague" },
  { value: "advertisement", label: "Advertisement" },
  { value: "other", label: "Other" },
] as const;

interface RegisterResponse {
  success: boolean;
  error?: string;
}

async function registerOrganization(body: unknown): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/api/organization/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Registration failed. Please try again.");
  }

  return data;
}

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [numberOfListings, setNumberOfListings] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function togglePropertyType(value: string) {
    setPropertyTypes((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
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
      await registerOrganization({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        country: country.trim() || undefined,
        organizationName: organizationName.trim(),
        numberOfListings: numberOfListings.trim()
          ? Number(numberOfListings)
          : undefined,
        propertyTypes,
        referralSource: referralSource || undefined,
      });

      // The account + organization exist now; establish this browser's
      // own session with the same credentials the user just typed, via
      // the same rate-limited backend endpoint the login page uses
      // (see its own comment for why this isn't a direct
      // supabase.auth.signInWithPassword call).
      const loginResponse = await fetch(`${API_URL}/api/organization/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const loginBody = await loginResponse.json().catch(() => null);

      if (!loginResponse.ok) {
        // Extremely unlikely (registration just succeeded with these
        // exact credentials) but handled rather than trapping the
        // user on a broken page — send them to log in manually.
        router.push("/auth/login");
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: loginBody.data.session.access_token,
        refresh_token: loginBody.data.session.refresh_token,
      });

      if (setSessionError) {
        router.push("/auth/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 py-12">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-8">
        <h1 className="text-3xl font-semibold text-foreground">
          Create your Hostly PMS Pro account
        </h1>

        <p className="mt-2 text-muted-foreground">
          Tell us about you and your business — you&apos;ll land straight in
          your dashboard.
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              About you
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="fullName">
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                />
              </Field>

              <Field label="Phone number" htmlFor="phone" optional>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 1234"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                />
              </Field>
            </div>

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" htmlFor="password">
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
              </Field>

              <Field label="Confirm password" htmlFor="confirmPassword">
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              About your business
            </p>

            <Field label="Organization / company name" htmlFor="organizationName">
              <input
                id="organizationName"
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Properties"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" htmlFor="country">
                <input
                  id="country"
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                />
              </Field>

              <Field label="Number of listings" htmlFor="numberOfListings" optional>
                <input
                  id="numberOfListings"
                  type="number"
                  min={0}
                  value={numberOfListings}
                  onChange={(e) => setNumberOfListings(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                />
              </Field>
            </div>

            <Field label="Property types you manage" htmlFor="propertyTypes" optional>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPE_OPTIONS.map((option) => {
                  const active = propertyTypes.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => togglePropertyType(option.value)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground/70 hover:bg-muted"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="How did you hear about us?" htmlFor="referralSource" optional>
              <select
                id="referralSource"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
              >
                <option value="">Select one (optional)</option>
                {REFERRAL_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
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
            {submitting ? "Creating your workspace..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:opacity-80">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-foreground/80">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        )}
      </label>

      {children}
    </div>
  );
}
