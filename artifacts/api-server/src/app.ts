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

app.set("trust proxy", true);

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
// 25mb so the AV interview can POST base64-encoded audio recordings for transcription.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

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
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// Global error handler — must be last
app.use(errorHandler);

export default app;
