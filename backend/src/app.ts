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

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "Hostly Backend",
    version: "1.0.0",
  });
});

app.use("/api/test", testRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/guests", GuestsRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/calendar", calendarRoutes);
app.use("/api/cleaning", cleaningRoutes);
app.use("/api/maintenance", maintenanceRoutes);

export default app;