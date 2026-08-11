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
    // Public so the page itself can render "please log in" (with the
    // token preserved) instead of the proxy silently redirecting an
    // unauthenticated visitor away before they ever see what
    // invitation they were sent — see
    // app/invitations/accept/page.tsx.
    pathname === "/invitations/accept" ||
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
