"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

/**
 * Where AIRBNB_REDIRECT_URI points. Airbnb (or the dev mock adapter)
 * redirects the browser here with ?state=&code= — this page then
 * makes an AUTHENTICATED POST to the backend with those values,
 * rather than the backend handling the raw redirect directly, because
 * this app's auth is Bearer-token only (no cookies) and a browser
 * navigation from Airbnb's domain can't carry that header. The result
 * is stashed in sessionStorage and the Integrations page picks it up
 * on load — see airbnb-api-section.tsx.
 */
export default function AirbnbCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatus message="Loading..." />}>
      <AirbnbCallbackContent />
    </Suspense>
  );
}

function AirbnbCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState("Connecting Airbnb...");

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const state = searchParams.get("state");
      const code = searchParams.get("code");
      const providerError = searchParams.get("error");

      if (providerError) {
        sessionStorage.setItem(
          "airbnb_api_callback_result",
          `Airbnb authorization was not completed: ${providerError}`
        );
        router.replace("/integrations");
        return;
      }

      if (!state || !code) {
        sessionStorage.setItem(
          "airbnb_api_callback_result",
          "Missing authorization details from Airbnb."
        );
        router.replace("/integrations");
        return;
      }

      try {
        await apiFetch("/api/integrations/airbnb/callback", {
          method: "POST",
          body: JSON.stringify({ state, code }),
        });

        if (cancelled) return;
        sessionStorage.setItem("airbnb_api_callback_result", "success");
      } catch (err) {
        if (cancelled) return;
        sessionStorage.setItem(
          "airbnb_api_callback_result",
          err instanceof Error ? err.message : "Unable to complete Airbnb authorization."
        );
      } finally {
        if (!cancelled) router.replace("/integrations");
      }
    }

    setStatusMessage("Connecting Airbnb...");
    complete();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <CallbackStatus message={statusMessage} />;
}

function CallbackStatus({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-slate-900" />
        <p className="mt-4 text-sm text-foreground/70">{message}</p>
      </div>
    </main>
  );
}
