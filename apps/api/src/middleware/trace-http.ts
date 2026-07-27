import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { createMiddleware } from "hono/factory";
import { getTracer, recordSpanError } from "@app/otel";

/**
 * Hono middleware that opens a SERVER span per request, continuing any
 * upstream trace from W3C `traceparent` headers. Bun.serve isn't covered by
 * OTel HTTP auto-instrumentation, so this is the trace root for the API.
 *
 * Lives here (not in @app/otel) so the shared package stays
 * framework-agnostic — the WS service consumes @app/otel without Hono.
 */
export function traceHttp() {
  return createMiddleware(async (c, next) => {
    const tracer = getTracer();
    const parentCtx = propagation.extract(context.active(), c.req.raw.headers, {
      keys: (carrier) => Array.from(carrier.keys()),
      get: (carrier, key) => carrier.get(key) ?? undefined,
    });

    const method = c.req.method;
    const path = c.req.path;

    await context.with(parentCtx, async () => {
      const span = tracer.startSpan(
        `${method} ${path}`,
        {
          kind: SpanKind.SERVER,
          attributes: {
            "http.request.method": method,
            "url.path": path,
          },
        },
        context.active(),
      );

      await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          try {
            await next();
            const matched = c.req.routePath;
            if (matched) {
              span.setAttribute("http.route", matched);
              span.updateName(`${method} ${matched}`);
            }
            span.setAttribute("http.response.status_code", c.res.status);
            if (c.res.status >= 500) {
              span.setAttribute("error", true);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${c.res.status}`,
              });
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }
          } catch (err) {
            recordSpanError(span, err);
            throw err;
          } finally {
            span.end();
          }
        },
      );
    });
  });
}
