import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// One hop: Railway's edge proxy. `true` trusted every X-Forwarded-For entry,
// so req.ip was whatever the client wrote first.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy — must be before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors());
// Only the AV interview posts big bodies (base64 audio for transcription).
// Everything else is capped low so anonymous callers can't make the server
// buffer and parse 25mb per request.
app.use("/api/interview/transcribe", express.json({ limit: "25mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Clerk auth middleware
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// 404 for any /api/* route that didn't match
app.use("/api", notFoundHandler);

// Serve the built frontend from a single origin (production/deploy).
// The deploy build copies artifacts/ninelab/dist/public into ./public next
// to the bundle. When that folder isn't present (local dev, where Vite serves
// the frontend separately), this whole block is skipped.
const publicDir = process.env.PUBLIC_DIR ?? path.join(__dirname, "public");
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(
    express.static(publicDir, {
      setHeaders(res, filePath) {
        // The service worker decides which build every installed client runs.
        // If a proxy or browser holds an old sw.js, those clients stay pinned
        // to a stale app indefinitely, so these three must always revalidate.
        // Hashed assets are untouched and stay long-cacheable.
        if (/(?:sw\.js|workbox-[^/\\]+\.js|manifest\.webmanifest|registerSW\.js)$/.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  // SPA fallback: any non-/api GET returns index.html so client-side routing works.
  // (/api/* is already handled + 404'd above, so it never reaches here.)
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    // A missing file (an old build's chunk, an image) is a real 404. Sending
    // index.html with 200 there breaks module loading with a MIME error and
    // lets the service worker cache HTML as an image.
    if (req.path.startsWith("/assets/") || /\.(?:m?js|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|json|webmanifest|txt|xml)$/i.test(req.path)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// Global error handler — must be last
app.use(errorHandler);

export default app;
