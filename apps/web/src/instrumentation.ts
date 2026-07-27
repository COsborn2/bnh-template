import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";

const HONEYCOMB_TRACES_ENDPOINT = "https://api.honeycomb.io/v1/traces";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "web";

// Next.js auto-loads this server-only file and calls register() once at
// server startup. It is never bundled into client JavaScript, so reading
// secrets from process.env here is safe.
//
// Backend selection mirrors packages/otel (used by the API/WS services):
//   1. OTEL_EXPORTER_OTLP_ENDPOINT set -> that OTLP backend
//   2. else HONEYCOMB_API_KEY set -> Honeycomb
//   3. neither -> no-op, so off-Vercel prod does not retry localhost exports
export function register(): void {
  const honeycombKey = process.env.HONEYCOMB_API_KEY;
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!honeycombKey && !otlpEndpoint) return;

  if (!otlpEndpoint && honeycombKey) {
    registerOTel({
      serviceName: SERVICE_NAME,
      traceExporter: new OTLPHttpProtoTraceExporter({
        url: HONEYCOMB_TRACES_ENDPOINT,
        headers: buildHoneycombHeaders(honeycombKey),
      }),
    });
    return;
  }

  if (honeycombKey) {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = serializeHeaders(
      buildHoneycombHeaders(honeycombKey),
    );
  }

  // Standard OTEL_EXPORTER_OTLP_* env (local Jaeger, other collectors).
  // registerOTel reads those vars itself and propagates outgoing fetch context.
  registerOTel({ serviceName: SERVICE_NAME });
}

function buildHoneycombHeaders(apiKey: string): Record<string, string> {
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  if (!headers["x-honeycomb-team"]) {
    headers["x-honeycomb-team"] = apiKey;
  }
  if (process.env.HONEYCOMB_DATASET && !headers["x-honeycomb-dataset"]) {
    headers["x-honeycomb-dataset"] = process.env.HONEYCOMB_DATASET;
  }
  return headers;
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

function serializeHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}
