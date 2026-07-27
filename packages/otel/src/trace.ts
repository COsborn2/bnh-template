import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";

const TRACER_NAME = "@app/otel";

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

export interface WithSpanOptions {
  kind?: SpanKind;
  attributes?: Attributes;
}

/**
 * Runs `fn` inside an active span. Records exceptions and marks the span as
 * errored, then re-throws so callers keep their existing control flow.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options: WithSpanOptions = {},
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(
    name,
    { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

export function recordSpanError(span: Span, err: unknown): void {
  span.setAttribute("error", true);
  span.recordException(err instanceof Error ? err : { message: String(err) });
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: err instanceof Error ? err.message : String(err),
  });
}

/** Active trace/span ids for log correlation. Empty object when no span. */
export function getTraceIds(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const ctx = span.spanContext();
  if (!ctx.traceId || ctx.traceId === "00000000000000000000000000000000") {
    return {};
  }
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

/** Serializes the active trace context into a plain carrier (W3C headers). */
export function injectTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Runs `fn` with the trace context extracted from `carrier` made active. Used
 * to continue a trace across a non-HTTP boundary (e.g. Redis pub/sub).
 */
export function withExtractedContext<T>(
  carrier: Record<string, string> | undefined | null,
  fn: () => T,
): T {
  if (!carrier) return fn();
  const active = propagation.extract(context.active(), carrier);
  return context.with(active, fn);
}

export { SpanKind, SpanStatusCode };
