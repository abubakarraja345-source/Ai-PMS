import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { startIcalScheduler } from "./modules/integrations/scheduler";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Hostly Backend running on http://localhost:${PORT}`);
});

const icalScheduler = startIcalScheduler();

/**
 * Graceful shutdown — orchestrators (Docker/Kubernetes/most PaaS)
 * send SIGTERM before a hard SIGKILL and expect the process to stop
 * accepting new connections, let in-flight ones finish, then exit.
 * Without this, the default Node behavior on signal is an immediate
 * teardown that can cut off requests mid-flight.
 */
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  icalScheduler.stop();

  server.close((err) => {
    if (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }

    process.exit(0);
  });

  // Safety net in case some connection never drains.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));