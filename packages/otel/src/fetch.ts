import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions";
import { getTracer, recordSpanError } from "./trace.js";

export interface TracedFetchOptions {
  /** Span name. Defaults to `HTTP <METHOD> <host>`. */
  spanName?: string;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Drop-in `fetch` that creates a CLIENT span and injects W3C trace headers.
 * Bun's native `fetch` is not picked up by OTel auto-instrumentation, so any
 * outbound call we want in a trace (third-party APIs, cross-service) must go
 * through this wrapper.
 */
export async function tracedFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  options: TracedFetchOptions = {},
): Promise<Response> {
  const url = input instanceof Request ? input.url : input.toString();
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "unknown";
  }
  const method = (
    init.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  const tracer = getTracer();
  return tracer.startActiveSpan(
    options.spanName ?? `HTTP ${method} ${host}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: method,
        [ATTR_URL_FULL]: url,
        [ATTR_SERVER_ADDRESS]: host,
        ...options.attributes,
      },
    },
    async (span) => {
      const headers = new Headers(
        init.headers ?? (input instanceof Request ? input.headers : {}),
      );
      propagation.inject(context.active(), headers, {
        set: (carrier, key, value) => carrier.set(key, String(value)),
      });

      try {
        const res = await fetch(input, { ...init, headers });
        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, res.status);
        if (res.status >= 400) {
          span.setAttribute("error", true);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.status}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        return res;
      } catch (err) {
        recordSpanError(span, err);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
