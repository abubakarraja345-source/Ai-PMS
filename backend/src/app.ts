import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import dashboardRoutes from "./routes/dashboard.routes";
import testRoutes from "./routes/test.routes";

import propertyRoutes from "./modules/properties/routes";
import { GuestsRouter } from "./modules/guests/routes";
import { reservationRouter } from "./modules/reservations/routes";
import calendarRoutes from "./modules/calendar/routes";
import cleaningRoutes from "./modules/cleaning/routes";
import maintenanceRoutes from "./modules/maintenance/routes";
import reportsRoutes from "./modules/reports/routes";
import organizationRoutes from "./modules/organization/routes";
import settingsRoutes from "./modules/settings/routes";
import notificationsRoutes from "./modules/notifications/routes";
import propertyImagesRoutes from "./modules/property-media/routes";
import propertyDetailsRoutes from "./modules/property-details/routes";
import {
  propertyInventoryRoutes,
  organizationInventoryRoutes,
} from "./modules/inventory/routes";
import integrationsRoutes from "./modules/integrations/routes";
import airbnbApiRoutes from "./modules/integrations/airbnbApi/routes";
import icalExportRoutes from "./modules/icalExport/routes";
import aiRoutes from "./modules/ai/routes";
import exchangeRatesRoutes from "./modules/exchangeRates/routes";
import auditLogRoutes from "./modules/auditLog/routes";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { errorMiddleware, notFoundHandler } from "./middleware/error.middleware";
import { env } from "./config/env";

const app = express();

app.use(helmet());

/**
 * In production, restrict to the known frontend origin if configured
 * (FRONTEND_URL). Left open in development (no FRONTEND_URL set by
 * default) to avoid breaking local dev against varying ports/hosts.
 * Auth is Bearer-token based, not cookie based, so an open dev CORS
 * policy doesn't itself enable session hijacking — this is
 * defense-in-depth for production, not a fix for an active exploit.
 */
app.use(
  cors(
    env.nodeEnv === "production" && env.frontendUrl
      ? { origin: env.frontendUrl }
      : {}
  )
);

app.use(compression());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(apiRateLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "Hostly Backend",
    version: "1.0.0",
  });
});

// Debug/introspection routes — dev-only, not part of the product API.
if (env.nodeEnv !== "production") {
  app.use("/api/test", testRoutes);
}
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/guests", GuestsRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/calendar", calendarRoutes);
app.use("/api/cleaning", cleaningRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/organization/settings", settingsRoutes);
app.use("/api/organization/exchange-rates", exchangeRatesRoutes);
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/properties/:propertyId/images", propertyImagesRoutes);
app.use("/api/properties/:propertyId", propertyDetailsRoutes);
app.use("/api/properties/:propertyId/inventory", propertyInventoryRoutes);
app.use("/api/inventory", organizationInventoryRoutes);
// Mounted BEFORE /api/integrations so its more specific prefix is
// matched first — the existing integrations router has a GET /:id
// route that would otherwise swallow /api/integrations/airbnb/* as
// id="airbnb" if this were registered after it.
app.use("/api/integrations/airbnb", airbnbApiRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/ical", icalExportRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;