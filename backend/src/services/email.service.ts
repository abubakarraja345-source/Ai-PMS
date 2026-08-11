import { Resend } from "resend";
import { env } from "../config/env";

/**
 * RESEND_API_KEY is a real config value in this project's env (the
 * `resend` package has been an installed dependency for a while), but
 * until now nothing ever actually called it — `send()` was a literal
 * no-op placeholder. This client is only constructed when the key is
 * present, so a deployment without it degrades to "email not
 * configured" instead of throwing.
 */
const resendClient = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Resend's own sandbox sender — works with no domain verification,
 * which is the honest, testable default for a project that hasn't
 * configured a custom sending domain. If a verified domain is added
 * later, this is the one line that needs to change.
 */
const FROM_ADDRESS = "AI PMS <onboarding@resend.dev>";

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
  const roleLabel = params.role === "company_admin" ? "Company Admin" : "Member";
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

export class EmailService {
  /** Original placeholder call sites (none currently exist) keep working
   * unchanged — no behavior removed, only new capability added. */
  static async send(): Promise<void> {
    // Placeholder email send
  }

  /**
   * Sends a team invitation email if Resend is configured; otherwise
   * returns a clear "not configured" result rather than pretending it
   * worked. Never throws — a failed/unconfigured email must not block
   * invitation creation, which already succeeded in the database by
   * the time this is called.
   *
   * Never logs the accept URL or any token — only Resend's own error
   * message (which never contains the email body) is logged on failure.
   */
  static async sendInvitation(
    params: SendInvitationEmailParams
  ): Promise<SendEmailResult> {
    if (!resendClient) {
      return { sent: false, reason: "Email delivery is not configured" };
    }

    try {
      const { error } = await resendClient.emails.send({
        from: FROM_ADDRESS,
        to: params.to,
        subject: `You've been invited to join ${params.organizationName} on AI PMS`,
        html: invitationHtml(params),
      });

      if (error) {
        console.error("Failed to send invitation email:", error.message);
        return { sent: false, reason: "Email delivery failed" };
      }

      return { sent: true };
    } catch (err) {
      console.error(
        "Failed to send invitation email:",
        err instanceof Error ? err.message : "Unknown error"
      );
      return { sent: false, reason: "Email delivery failed" };
    }
  }
}
