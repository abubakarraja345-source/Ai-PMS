import { Router } from "express";
import { buildIcsFeedForToken } from "./service";

// Mounted at /api/ical. Deliberately NOT gated by requireAuth/
// requireOrganization — external calendar providers (Airbnb,
// Booking.com, VRBO, or any generic iCal-import feature) fetch this
// with no session at all, exactly like organization/routes.ts's
// public GET /invitations/:token. The token itself is the entire
// authorization; there is no "wrong organization" case to gate here
// the way authenticated routes are, since the lookup is token-only.
const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const rawParam = req.params.token ?? "";
    const token = rawParam.endsWith(".ics")
      ? rawParam.slice(0, -4)
      : rawParam;

    if (!token) {
      return res.status(404).json({ success: false, error: "Feed not found" });
    }

    const { content } = await buildIcsFeedForToken(token);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(content);
  } catch (error) {
    // Never logs the token itself — only that a lookup failed.
    console.error(
      "iCal export error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return res.status(404).json({ success: false, error: "Feed not found" });
  }
});

export default router;
