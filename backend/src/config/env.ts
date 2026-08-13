import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5000),

  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  geminiApiKey: process.env.GEMINI_API_KEY,

  /**
   * Brevo transactional email (invitations only — see
   * services/email.service.ts). All three are optional at the env
   * level; isBrevoConfigured() there requires apiKey AND senderEmail
   * before attempting a send, and fails closed ("email not
   * configured") rather than guessing a sender when either is
   * missing. senderName has a safe default and is not required.
   */
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  brevoSenderName: process.env.BREVO_SENDER_NAME,

  redisUrl: process.env.REDIS_URL,

  jwtSecret: process.env.JWT_SECRET,

  frontendUrl: process.env.FRONTEND_URL,

  nodeEnv: process.env.NODE_ENV || "development",

  /**
   * Airbnb Official API (Phase 6A) — all optional and unset by
   * default. No real Airbnb partner/API access exists for this
   * project yet; every one of these being undefined is the expected,
   * normal state. The Airbnb API module fails closed ("Airbnb API
   * credentials are not configured") rather than fabricating a
   * connection when any of these are missing — see
   * modules/integrations/airbnbApi/adapter.ts. Never fabricate values
   * for these; they can only come from an official Airbnb
   * partner/developer application.
   */
  airbnbClientId: process.env.AIRBNB_CLIENT_ID,
  airbnbClientSecret: process.env.AIRBNB_CLIENT_SECRET,
  airbnbRedirectUri: process.env.AIRBNB_REDIRECT_URI,
  airbnbAuthorizationUrl: process.env.AIRBNB_AUTHORIZATION_URL,
  airbnbTokenUrl: process.env.AIRBNB_TOKEN_URL,
  airbnbApiBaseUrl: process.env.AIRBNB_API_BASE_URL,

  /**
   * WhatsApp Business Cloud API (Meta Graph API) — guest messaging.
   * Unlike Airbnb's gated partner API, this is Meta's public, stable,
   * documented API, so the adapter built against it is a real working
   * implementation, not a permanently-throwing stub — it just still
   * fails closed ("WhatsApp is not configured") until real values are
   * set, since no credentials exist for this project yet. Get these
   * from Meta's App Dashboard (developers.facebook.com) under a
   * WhatsApp Business app: phone_number_id and a permanent access
   * token require completing Meta's business verification for
   * anything beyond test-mode messaging to pre-approved numbers.
   */
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET,
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",

  /**
   * IMPORTANT ARCHITECTURAL LIMITATION, stated plainly: a WhatsApp
   * Business webhook is ONE global endpoint per Meta app — Meta has no
   * concept of this PMS's multi-tenant organizations, so an inbound
   * message can't self-report which organization it belongs to the
   * way every other org-scoped table in this app can. This phase
   * therefore supports exactly ONE WhatsApp Business number for the
   * WHOLE backend deployment, associated with ONE organization via
   * this variable. A genuinely multi-tenant version (one WhatsApp
   * number per organization, credentials stored per-org like the
   * Airbnb integration, webhook routed by matching phone_number_id)
   * was NOT built here — this is a deliberate scope boundary, not an
   * oversight, and is called out explicitly in the messaging module's
   * own comments and this phase's final report.
   */
  whatsappOrganizationId: process.env.WHATSAPP_ORGANIZATION_ID,
};