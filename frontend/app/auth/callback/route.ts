import { createClient } from "@/lib/supabase/server";
import { isSafeInternalPath } from "@/lib/safe-redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  // Supabase preserves any extra query params that were present in the
  // emailRedirectTo passed to signInWithOtp (see app/auth/login/page.tsx),
  // so `next` — if the user was mid-way through accepting an invitation —
  // survives the round trip here. Re-validated (not just re-trusted) so
  // a tampered callback URL can never redirect somewhere external.
  const next = searchParams.get("next");
  const destination = next && isSafeInternalPath(next) ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}