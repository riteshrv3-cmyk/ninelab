import type { ErrorRequestHandler, RequestHandler } from "express";

function isZodError(err: unknown): err is { name: string; issues: Array<{ path: (string | number)[]; message: string }> } {
  return typeof err === "object" && err !== null
    && (err as { name?: string }).name === "ZodError"
    && Array.isArray((err as { issues?: unknown }).issues);
}

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "Not Found",
    code: "NOT_FOUND",
    path: req.originalUrl,
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const log = (req as { log?: { error: (obj: unknown, msg: string) => void } }).log;
  log?.error({ err, url: req.originalUrl, method: req.method }, "request failed");

  if (res.headersSent) return;

  if (isZodError(err)) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      issues: err.issues.map(i => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code ?? "HTTP_ERROR",
    });
    return;
  }

  // body-parser / http-errors (413 too large, 400 bad JSON) carry their own
  // 4xx status; they are the client's mistake, not a server failure.
  const status = (err as { status?: unknown; statusCode?: unknown })?.status ?? (err as { statusCode?: unknown })?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const expose = (err as { expose?: boolean }).expose === true;
    res.status(status).json({
      error: status === 413 ? "Upload too large" : expose && err instanceof Error ? err.message : "Bad request",
      code: status === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: isProd ? "Internal server error" : message,
    code: "INTERNAL_ERROR",
  });
};
