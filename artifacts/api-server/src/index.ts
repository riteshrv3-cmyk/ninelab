import app from "./app";
import { logger } from "./lib/logger";
import { ensureDefaultTracks } from "./lib/defaultTracks";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed the shipped default learning tracks (idempotent). Non-fatal: a seeding
  // failure must not take the server down.
  ensureDefaultTracks()
    .then(() => logger.info("Default learning tracks ensured"))
    .catch((err) => logger.error({ err }, "Failed to ensure default tracks"));
});
