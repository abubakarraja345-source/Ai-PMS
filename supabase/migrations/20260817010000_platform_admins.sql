-- Phase 7 — platform-level Super Admin, deliberately NOT an
-- organization member and NOT "owner of every organization." A
-- platform admin is any auth.users row with a corresponding row here.
--
-- SECURITY: this table intentionally receives ONLY a SELECT grant
-- below — no INSERT/UPDATE/DELETE grant for service_role. Since
-- service_role is the only database role this backend (or anything
-- else) ever authenticates as, that means NOTHING in the application
-- — no API route, no matter how it's ever wired up in the future —
-- can insert a row here. The only way to grant platform-admin status
-- is a manual INSERT run by a human directly in the Supabase Dashboard
-- SQL Editor. This is the database-enforced version of "Super Admin
-- cannot be created by normal users," not just an application-code
-- convention.
--
-- To grant yourself platform-admin access after this migration runs,
-- execute (in the SQL Editor, replacing the UUID with your own
-- auth.users id):
--
--   INSERT INTO platform_admins (user_id, label, created_note)
--   VALUES ('<your-auth-user-uuid>', '<your-email>', 'initial platform admin');

CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NULL,
  created_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO service_role;
