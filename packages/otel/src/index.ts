export { startTelemetry, shutdownTelemetry } from "./init.js";
export type { StartTelemetryOptions } from "./init.js";
export {
  withSpan,
  recordSpanError,
  getTraceIds,
  getTracer,
  injectTraceContext,
  withExtractedContext,
  SpanKind,
  SpanStatusCode,
} from "./trace.js";
export type { WithSpanOptions } from "./trace.js";
export { tracedFetch } from "./fetch.js";
export type { TracedFetchOptions } from "./fetch.js";
export { withServerSpan } from "./server.js";
