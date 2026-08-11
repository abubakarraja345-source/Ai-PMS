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
