import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
} from "@opentelemetry/api";
import { ATTR_HTTP_RESPONSE_STATUS_CODE } from "@opentelemetry/semantic-conventions";
import { getTracer, recordSpanError } from "./trace.js";

/**
 * Opens a SERVER span continuing any upstream W3C trace found in `headers`.
 * Used by services that don't run Hono (the Bun.serve WS handler).
 */
export async function withServerSpan<T>(
  name: string,
  headers: Headers,
  fn: () => Promise<T>,
  attributes: Attributes = {},
): Promise<T> {
  const tracer = getTracer();
  const parentCtx = propagation.extract(context.active(), headers, {
    keys: (carrier: Headers) => Array.from(carrier.keys()),
    get: (carrier: Headers, key: string) => carrier.get(key) ?? undefined,
  });

  return context.with(parentCtx, () => {
    const span = tracer.startSpan(
      name,
      { kind: SpanKind.SERVER, attributes },
      context.active(),
    );
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn();
        if (result instanceof Response) {
          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, result.status);
          if (result.status >= 500) {
            span.setAttribute("error", true);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${result.status}`,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        return result;
      } catch (err) {
        recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    });
  });
}
