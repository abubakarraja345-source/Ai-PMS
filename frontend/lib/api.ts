import { createClient } from "@/lib/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** sessionStorage key for an active platform-admin "entered
 * organization" session token — see app/admin's enter-organization
 * flow and (dashboard)/layout.tsx's viewing-as banner. sessionStorage
 * (not localStorage) deliberately: this is a short-lived (15 min),
 * read-only viewing session that should never silently persist across
 * browser restarts. */
export const PLATFORM_ADMIN_SESSION_KEY = "hostly_platform_admin_session";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You are not authenticated");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Content-Type", "application/json");

  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(PLATFORM_ADMIN_SESSION_KEY);

    if (raw) {
      try {
        const { token } = JSON.parse(raw) as { token: string };
        if (token) {
          headers.set("X-Platform-Admin-Session", token);
        }
      } catch {
        // Malformed sessionStorage entry — ignore, request proceeds
        // as a normal (non-override) authenticated request.
      }
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "API request failed") as Error & {
      data?: unknown;
      status?: number;
    };

    error.data = data.data;
    error.status = response.status;

    throw error;
  }

  return data;
}
