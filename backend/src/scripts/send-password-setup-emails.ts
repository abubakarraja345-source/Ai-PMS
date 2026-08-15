/**
 * One-time migration script — NOT an API route, run manually and once.
 *
 * Every account created before password-based auth existed was
 * created via Supabase magic-link (signInWithOtp), so none of them
 * have a password set. This sends every existing auth user a Supabase
 * recovery link (emailed via our own Brevo-based EmailService, for a
 * branded/consistent look rather than Supabase's own hosted email) so
 * they can set one — see frontend/app/auth/set-password/page.tsx for
 * where that link lands them.
 *
 * Usage:
 *   npx tsx src/scripts/send-password-setup-emails.ts --dry-run   (default — lists who would be emailed, sends nothing)
 *   npx tsx src/scripts/send-password-setup-emails.ts --send      (actually sends)
 */
import { env } from "../config/env";
import { supabase } from "../config/supabase";
import { EmailService } from "../services/email.service";

const isSend = process.argv.includes("--send");

function setPasswordRedirect(): string {
  const base = env.frontendUrl || "http://localhost:3000";
  return `${base}/auth/set-password`;
}

async function fetchAllUsers() {
  const users: { id: string; email: string | null }[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null })));

    if (data.users.length < perPage) break;
  }

  return users;
}

async function main() {
  const users = await fetchAllUsers();
  const withEmail = users.filter((u) => u.email);

  console.log(
    `Found ${users.length} total accounts (${withEmail.length} with an email address).`
  );

  if (!isSend) {
    console.log("\nDRY RUN — no emails will be sent. Pass --send to actually send.\n");
    withEmail.forEach((u) => console.log(`  would email: ${u.email}`));
    return;
  }

  console.log(`\nSending password-setup emails to ${withEmail.length} accounts...\n`);

  let sent = 0;
  let failed = 0;

  for (const user of withEmail) {
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: user.email!,
        options: { redirectTo: setPasswordRedirect() },
      });

      if (error || !data?.properties?.action_link) {
        console.error(`  [FAIL] ${user.email} — could not generate link: ${error?.message}`);
        failed++;
        continue;
      }

      const result = await EmailService.sendPasswordSetup({
        to: user.email!,
        setPasswordUrl: data.properties.action_link,
      });

      if (result.sent) {
        console.log(`  [OK] ${user.email}`);
        sent++;
      } else {
        console.error(`  [FAIL] ${user.email} — ${result.reason}`);
        failed++;
      }
    } catch (err) {
      console.error(
        `  [FAIL] ${user.email} — ${err instanceof Error ? err.message : "unknown error"}`
      );
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}.`);
}

main().catch((err) => {
  console.error("Migration script failed:", err);
  process.exitCode = 1;
});
