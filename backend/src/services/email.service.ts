import { env } from "../config/env";
import { ROLE_LABELS } from "../modules/permissions/roles";
import { OrganizationRole } from "../middleware/organization.middleware";

/**
 * Phase 7 bug fix: this used to hardcode `role === "company_admin" ?
 * "Company Admin" : "Member"`, silently mislabeling every invitation
 * to a manager/host/spectator as "Member" once those roles existed —
 * caught during Checkpoint 7.5 live testing. Now reads from the same
 * ROLE_LABELS map the rest of the app uses, so it can never drift out
 * of sync with a role added there. Falls back to the raw value for
 * anything genuinely unrecognized rather than a wrong label.
 */
function roleDisplayLabel(role: string): string {
  return ROLE_LABELS[role as OrganizationRole] ?? role;
}

/**
 * Brevo's transactional email REST API (v3) — a single well-documented
 * POST endpoint, so this calls it directly via fetch rather than
 * pulling in the official @getbrevo/brevo SDK, matching this
 * codebase's existing convention for external HTTP integrations (see
 * modules/messaging/whatsapp/adapter.ts, integrations/airbnbApi's
 * OAuth calls — both plain fetch, no vendor SDK).
 */
const BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

function isBrevoConfigured(): boolean {
  return Boolean(env.brevoApiKey && env.brevoSenderEmail);
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export interface SendTeamMemberCredentialsParams {
  to: string;
  organizationName: string;
  inviterEmail: string | null;
  role: string;
  tempPassword: string;
  loginUrl: string;
}

/**
 * Sent when a brand-new account was created for an invited team
 * member (see organization/invitations.service.ts's createInvitation)
 * — this is the ONLY place the temporary password ever leaves the
 * backend, and only ever to the invitee's own email address, never
 * back to the caller/inviter. The account's must_change_password
 * metadata forces them to set a new one on first login (see
 * frontend/app/auth/set-password), so this password is single-use in
 * practice even though nothing stops it being reused if the reset is
 * skipped.
 */
function teamMemberCredentialsHtml(params: SendTeamMemberCredentialsParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You've been added to ${params.organizationName}</h2>
      <p>You've been added${inviter} to <strong>${params.organizationName}</strong> on Hostly PMS Pro as a <strong>${roleLabel}</strong>.</p>
      <p>Your login details:</p>
      <table style="margin:12px 0;font-size:14px;">
        <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Email</td><td><strong>${params.to}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Temporary password</td><td><strong>${params.tempPassword}</strong></td></tr>
      </table>
      <p>You'll be asked to set your own password the first time you log in.</p>
      <p><a href="${params.loginUrl}" style="display:inline-block;padding:12px 20px;background:#10172a;color:#fff;text-decoration:none;border-radius:8px;">Log in</a></p>
    </div>
  `;
}

function teamMemberCredentialsText(params: SendTeamMemberCredentialsParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return [
    `You've been added to ${params.organizationName}`,
    ``,
    `You've been added${inviter} to ${params.organizationName} on Hostly PMS Pro as a ${roleLabel}.`,
    ``,
    `Email: ${params.to}`,
    `Temporary password: ${params.tempPassword}`,
    ``,
    `You'll be asked to set your own password the first time you log in.`,
    ``,
    `Log in: ${params.loginUrl}`,
  ].join("\n");
}

export interface SendAddedToOrganizationParams {
  to: string;
  organizationName: string;
  inviterEmail: string | null;
  role: string;
  loginUrl: string;
}

/**
 * Sent when an invited email already had an account (reused as-is —
 * see createInvitation) — no password is generated or included here,
 * since they already have one.
 */
function addedToOrganizationHtml(params: SendAddedToOrganizationParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You've been added to ${params.organizationName}</h2>
      <p>You've been added${inviter} to <strong>${params.organizationName}</strong> on Hostly PMS Pro as a <strong>${roleLabel}</strong>.</p>
      <p>Log in with your existing account to get started.</p>
      <p><a href="${params.loginUrl}" style="display:inline-block;padding:12px 20px;background:#10172a;color:#fff;text-decoration:none;border-radius:8px;">Log in</a></p>
    </div>
  `;
}

function addedToOrganizationText(params: SendAddedToOrganizationParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return [
    `You've been added to ${params.organizationName}`,
    ``,
    `You've been added${inviter} to ${params.organizationName} on Hostly PMS Pro as a ${roleLabel}.`,
    ``,
    `Log in with your existing account: ${params.loginUrl}`,
  ].join("\n");
}

export interface SendPasswordSetupParams {
  to: string;
  setPasswordUrl: string;
}

/**
 * The one-time account-migration email — see
 * scripts/send-password-setup-emails.ts. Every pre-existing account
 * was created before password-based auth existed (magic-link only),
 * so none of them have a password set; this is how they get one
 * without being locked out. setPasswordUrl is a Supabase recovery
 * link (admin.generateLink({type:'recovery', ...})), not something
 * this service constructs itself.
 */
function passwordSetupHtml(params: SendPasswordSetupParams): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Set your Hostly PMS Pro password</h2>
      <p>We've added password login to Hostly PMS Pro. Set a password for your account (${params.to}) to keep using it — this only takes a moment.</p>
      <p><a href="${params.setPasswordUrl}" style="display:inline-block;padding:12px 20px;background:#10172a;color:#fff;text-decoration:none;border-radius:8px;">Set your password</a></p>
      <p style="color:#64748b;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:<br/>${params.setPasswordUrl}</p>
    </div>
  `;
}

function passwordSetupText(params: SendPasswordSetupParams): string {
  return [
    `Set your Hostly PMS Pro password`,
    ``,
    `We've added password login to Hostly PMS Pro. Set a password for your account (${params.to}) to keep using it — this only takes a moment.`,
    ``,
    `Set your password: ${params.setPasswordUrl}`,
  ].join("\n");
}

interface BrevoErrorBody {
  code?: string;
  message?: string;
}

/**
 * Posts one transactional email to Brevo. Never throws — a failed or
 * unconfigured send must not block invitation creation, which has
 * already succeeded in the database by the time this is called (see
 * invitations.service.ts: insertInvitation happens first, this is a
 * best-effort follow-up).
 *
 * Only ever logs Brevo's own {code, message} error body (which never
 * contains the email content, recipient PII beyond what the caller
 * already knows, or any secret) — never the API key, never the
 * accept URL/token, and never the raw response object wholesale.
 *
 * The boolean this returns reflects exactly one thing: whether Brevo
 * accepted the send request (HTTP 2xx). It says nothing about actual
 * inbox delivery — Brevo's API response doesn't and can't promise
 * that, so this never claims more than it can prove.
 */
async function sendViaBrevo(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  if (!isBrevoConfigured()) {
    return { sent: false, reason: "Email delivery is not configured" };
  }

  const senderName = env.brevoSenderName?.trim() || "Hostly PMS Pro";

  try {
    const response = await fetch(BREVO_SEND_EMAIL_URL, {
      method: "POST",
      headers: {
        "api-key": env.brevoApiKey!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: env.brevoSenderEmail },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
      }),
    });

    if (!response.ok) {
      let errorBody: BrevoErrorBody | null = null;

      try {
        errorBody = (await response.json()) as BrevoErrorBody;
      } catch {
        // Brevo error responses are normally JSON; a non-JSON body
        // (e.g. an upstream proxy error page) just means we have
        // nothing more specific to log below.
      }

      console.error(
        "Brevo rejected the email request:",
        response.status,
        errorBody?.code ?? "",
        errorBody?.message ?? response.statusText
      );

      return { sent: false, reason: "Email delivery failed" };
    }

    return { sent: true };
  } catch (err) {
    console.error(
      "Failed to reach Brevo:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return { sent: false, reason: "Email delivery failed" };
  }
}

export class EmailService {
  /** Original placeholder call sites (none currently exist) keep working
   * unchanged — no behavior removed, only new capability added. */
  static async send(): Promise<void> {
    // Placeholder email send
  }

  /**
   * Sends a newly-provisioned team member their login credentials.
   * Never throws.
   */
  static async sendTeamMemberCredentials(
    params: SendTeamMemberCredentialsParams
  ): Promise<SendEmailResult> {
    return sendViaBrevo({
      to: params.to,
      subject: `You've been added to ${params.organizationName} on Hostly PMS Pro`,
      html: teamMemberCredentialsHtml(params),
      text: teamMemberCredentialsText(params),
    });
  }

  /**
   * Notifies an invitee who already had an account that they've been
   * added to a new organization — no credentials to send. Never
   * throws.
   */
  static async sendAddedToOrganization(
    params: SendAddedToOrganizationParams
  ): Promise<SendEmailResult> {
    return sendViaBrevo({
      to: params.to,
      subject: `You've been added to ${params.organizationName} on Hostly PMS Pro`,
      html: addedToOrganizationHtml(params),
      text: addedToOrganizationText(params),
    });
  }

  /**
   * The one-time existing-account password-migration email — see
   * scripts/send-password-setup-emails.ts. Never throws.
   */
  static async sendPasswordSetup(
    params: SendPasswordSetupParams
  ): Promise<SendEmailResult> {
    return sendViaBrevo({
      to: params.to,
      subject: `Set your Hostly PMS Pro password`,
      html: passwordSetupHtml(params),
      text: passwordSetupText(params),
    });
  }
}

/** Startup-only, non-secret status line — see server.ts. Never prints
 * the API key or sender identity beyond what's already public. */
export function emailConfigStatusLine(): string {
  return isBrevoConfigured()
    ? "[Email] Brevo transactional email configured"
    : "[Email] Brevo not configured — invitation emails will be skipped (dev accept links still work)";
}
