/**
 * Guards the "next" redirect param used by the login → magic-link →
 * callback chain (see app/auth/login/page.tsx, app/auth/callback/route.ts,
 * proxy.ts) so it can only ever point at a same-origin relative path —
 * never an absolute or protocol-relative URL. Without this, a crafted
 * `/auth/login?next=https://evil.example` (or `next=//evil.example`)
 * link could turn a legitimate login flow into an open redirect.
 */
export function isSafeInternalPath(path: string): boolean {
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
  );
}
