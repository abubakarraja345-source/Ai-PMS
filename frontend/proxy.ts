import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths that never require a session. Everything else is protected —
 * a denylist-of-public-paths (rather than an allowlist of dashboard
 * routes) so a newly added dashboard page is protected by default
 * instead of silently falling through unauthenticated, which is what
 * happened before this file existed (only `/dashboard` itself had a
 * server-side redirect; every other dashboard route rendered its
 * shell for signed-out visitors and only failed client-side).
 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthEntryPath =
    pathname === "/auth/login" ||
    pathname === "/login" ||
    pathname === "/auth/register";

  if (!isPublicPath(pathname) && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  /*
   * Single choke point for "must set a new password before doing
   * anything else" — a team member's account is created with this
   * metadata flag set (see organization/invitations.service.ts), and
   * the login page's own post-sign-in redirect only covers the
   * sign-in moment itself. Enforcing it here too means the rule holds
   * even if they already had a session, typed a URL directly, or
   * reloaded mid-flow — the same reasoning applied to the platform
   * admin read-only enforcement (organization.middleware.ts).
   */
  if (
    user?.user_metadata?.must_change_password === true &&
    pathname !== "/auth/set-password" &&
    !isPublicPath(pathname)
  ) {
    return NextResponse.redirect(new URL("/auth/set-password", request.url));
  }

  /*
   * Organization membership can't be checked here — the anon/
   * authenticated Postgres role has no grants on any table
   * (confirmed during Phase G's security audit; the Express
   * backend's service-role client is the only path to that data),
   * so this proxy can only ever gate on authentication. An
   * authenticated user with no organization still lands on
   * /dashboard here; (dashboard)/layout.tsx then resolves their
   * organization via the backend (the actual source of truth) and
   * redirects to /onboarding if none exists. /onboarding itself is
   * intentionally NOT in isPublicPath, so an unauthenticated visitor
   * is still sent to /auth/login by the check above.
   */
  if (isAuthEntryPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
