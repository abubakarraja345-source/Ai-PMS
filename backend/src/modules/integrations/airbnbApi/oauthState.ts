import crypto from "crypto";

/**
 * Signed, stateless OAuth CSRF-state tokens — no database table.
 * Bound to (organizationId, userId) and a short expiry, HMAC-signed
 * with a key generated once at process startup. The state parameter
 * only needs to survive from "click Connect Airbnb" to the OAuth
 * callback a few seconds to minutes later, entirely within one
 * running backend process, so an in-memory key is sufficient and
 * avoids both a new table and a new required secret to configure.
 *
 * Tradeoff, stated plainly: a backend restart between generating a
 * state and its callback invalidates that one in-flight authorization
 * attempt (the user would just see "invalid or expired" and retry
 * Connect Airbnb) — acceptable given the short expected window.
 */
const STATE_KEY = crypto.randomBytes(32);
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  organizationId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", STATE_KEY).update(payload).digest("hex");
}

export function generateOAuthState(
  organizationId: string,
  userId: string
): string {
  const payload: StatePayload = {
    organizationId,
    userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

/**
 * Verifies signature, expiry, and that the state was issued for this
 * exact organization/user — returns null on ANY failure rather than
 * throwing, so the callback controller can render one uniform "invalid
 * or expired authorization" response without distinguishing why.
 */
export function verifyOAuthState(
  state: string,
  organizationId: string,
  userId: string
): boolean {
  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) return false;

  const expectedSignature = sign(encoded);

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return false;
  }

  let payload: StatePayload;

  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return false;
  }

  if (Date.now() > payload.expiresAt) return false;
  if (payload.organizationId !== organizationId) return false;
  if (payload.userId !== userId) return false;

  return true;
}
