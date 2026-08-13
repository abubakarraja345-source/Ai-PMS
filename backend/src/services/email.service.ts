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

export interface SendInvitationEmailParams {
  to: string;
  organizationName: string;
  inviterEmail: string | null;
  role: string;
  acceptUrl: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

function invitationHtml(params: SendInvitationEmailParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You've been invited to ${params.organizationName}</h2>
      <p>You've been invited${inviter} to join <strong>${params.organizationName}</strong> on AI PMS as a <strong>${roleLabel}</strong>.</p>
      <p><a href="${params.acceptUrl}" style="display:inline-block;padding:12px 20px;background:#10172a;color:#fff;text-decoration:none;border-radius:8px;">Accept Invitation</a></p>
      <p style="color:#64748b;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:<br/>${params.acceptUrl}</p>
    </div>
  `;
}

/** Plain-text fallback for clients that don't render HTML — same
 * content as invitationHtml, no formatting. */
function invitationText(params: SendInvitationEmailParams): string {
  const roleLabel = roleDisplayLabel(params.role);
  const inviter = params.inviterEmail ? ` by ${params.inviterEmail}` : "";

  return [
    `You've been invited to ${params.organizationName}`,
    ``,
    `You've been invited${inviter} to join ${params.organizationName} on AI PMS as a ${roleLabel}.`,
    ``,
    `Accept your invitation: ${params.acceptUrl}`,
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

  const senderName = env.brevoSenderName?.trim() || "Hostly";

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
   * Sends a team invitation email if Brevo is configured; otherwise
   * returns a clear "not configured" result rather than pretending it
   * worked. Never throws.
   */
  static async sendInvitation(
    params: SendInvitationEmailParams
  ): Promise<SendEmailResult> {
    return sendViaBrevo({
      to: params.to,
      subject: `You've been invited to join ${params.organizationName} on AI PMS`,
      html: invitationHtml(params),
      text: invitationText(params),
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
