import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5000),

  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  geminiApiKey: process.env.GEMINI_API_KEY,

  resendApiKey: process.env.RESEND_API_KEY,

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
};