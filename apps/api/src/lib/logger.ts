import winston from "winston";
import { getTraceIds } from "@app/otel";
import { getRequestId } from "./request-context-store.js";

type LogMeta = Record<string, unknown>;

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export const logger = {
  info(event: string, meta: LogMeta = {}) {
    write("info", event, meta);
  },
  warn(event: string, meta: LogMeta = {}) {
    write("warn", event, meta);
  },
  error(event: string, meta: LogMeta = {}) {
    write("error", event, meta);
  },
};

// Cap on any single string written into a log line. Bounded so that an error
// whose message echoes the request body (e.g. ZodError on a giant payload)
// cannot pin large strings in the logger's transport queue.
const MAX_LOG_STRING_CHARS = 8 * 1024;

function clampLogString(value: string | undefined): string | undefined {
  if (value === undefined) return value;
  if (value.length <= MAX_LOG_STRING_CHARS) return value;
  const overflow = value.length - MAX_LOG_STRING_CHARS;
  return `${value.slice(0, MAX_LOG_STRING_CHARS)}…[truncated ${overflow} chars]`;
}

export function errorLogValue(err: unknown): LogMeta {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: clampLogString(err.message),
      stack: clampLogString(err.stack),
    };
  }
  return { message: clampLogString(String(err)) };
}

function write(level: "info" | "warn" | "error", event: string, meta: LogMeta): void {
  const requestId = getRequestId();
  const { traceId, spanId } = getTraceIds();
  baseLogger.log({
    level,
    message: event,
    event,
    ...(requestId && meta.requestId === undefined ? { requestId } : {}),
    ...(traceId ? { traceId, spanId } : {}),
    ...meta,
  });
}
