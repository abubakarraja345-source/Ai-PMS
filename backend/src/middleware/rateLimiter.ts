import { rateLimit } from "express-rate-limit";

/**
 * Generic response shape matching every other module's convention
 * ({success, error}), so a 429 looks like any other API error to
 * the frontend instead of a differently-shaped payload.
 */
function rateLimitResponse(message: string) {
  return { success: false, error: message };
}

/**
 * Applied globally. Generous enough that normal dashboard usage
 * (many small GETs as a user navigates) never hits it, but bounds
 * brute-force/scraping abuse against an API that has no other
 * rate limiting anywhere in front of it (no gateway/WAF assumed).
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many requests — please slow down and try again shortly."),
});

/**
 * Stricter limit specifically for the AI chat endpoint — each call
 * costs real Gemini API quota (and, unlike a normal CRUD request,
 * can take several seconds and multiple tool-calling round-trips),
 * so it needs a tighter bound than the rest of the API.
 */
export const aiChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many AI requests — please wait a few minutes and try again."
  ),
});

/**
 * Applied to invitation create + resend — both send an email, so both
 * are the abuse surface (spamming an arbitrary inbox with invitation
 * emails). Generous enough for genuine team-building (a real org
 * inviting its whole team in one sitting) while bounding rapid-fire
 * abuse.
 */
export const invitationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many invitation requests — please wait a few minutes and try again."
  ),
});

/**
 * Applied to public registration — creates a real Supabase auth
 * account per request, unauthenticated, so this is the abuse surface
 * for account-creation spam / email enumeration. Tighter than the
 * invitation limiter since a single visitor has no legitimate reason
 * to register many times in a row.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many registration attempts — please wait a few minutes and try again."
  ),
});

/**
 * Applied to login — the classic brute-force target. Password login
 * is proxied through our own backend specifically so this limiter can
 * sit in front of it (see organization/routes.ts's POST /login);
 * Supabase's own project-level auth rate limits still apply
 * independently underneath this as a second layer. Generous enough
 * that a user who mistypes their password a few times in a row never
 * gets blocked, tight enough to slow down credential stuffing.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many login attempts — please wait a few minutes and try again."
  ),
});
