import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import {
  ExportResultCode,
  W3CTraceContextPropagator,
  type ExportResult,
} from "@opentelemetry/core";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import { resourceFromAttributes, type Resource } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const HONEYCOMB_DEFAULT_ENDPOINT = "https://api.honeycomb.io";
const DEFAULT_EXPORT_TIMEOUT_MS = 10_000;

let started = false;
let provider: NodeTracerProvider | null = null;

export interface StartTelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
}

/**
 * Minimal fetch-based OTLP/HTTP JSON exporter. The stock
 * `@opentelemetry/exporter-trace-otlp-http` crashes at startup under Bun, so
 * we serialize with JsonTraceSerializer and POST the payload ourselves.
 */
class OtlpHttpTraceExporter implements SpanExporter {
  private readonly pending = new Set<Promise<void>>();
  private stopped = false;

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
    private readonly timeoutMillis: number,
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    if (this.stopped) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error("OTLP trace exporter is shut down"),
      });
      return;
    }

    const body = JsonTraceSerializer.serializeRequest(spans);
    if (!body) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error("OTLP trace export produced no payload"),
      });
      return;
    }

    const request = this.send(body, resultCallback);
    this.pending.add(request);
    request.then(
      () => this.pending.delete(request),
      () => this.pending.delete(request),
    );
  }

  async forceFlush(): Promise<void> {
    await Promise.allSettled(this.pending);
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    await this.forceFlush();
  }

  private async send(
    body: Uint8Array,
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMillis);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: body as BodyInit,
        signal: controller.signal,
      });

      if (response.ok) {
        resultCallback({ code: ExportResultCode.SUCCESS });
        return;
      }

      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error(
          `OTLP trace export failed with HTTP ${response.status} ${response.statusText}`,
        ),
      });
    } catch (err) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Resolves the OTLP/HTTP exporter config. Honeycomb is a first-class
 * convenience (set HONEYCOMB_API_KEY), but any OTLP backend works by
 * setting the standard OTEL_EXPORTER_OTLP_* env vars instead.
 */
function resolveExporter(): SpanExporter | null {
  const explicitTracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const explicitBaseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const honeycombKey = process.env.HONEYCOMB_API_KEY;

  // Nothing configured: telemetry is a no-op so local dev runs without a
  // collector and without noisy export failures.
  if (!explicitTracesEndpoint && !explicitBaseEndpoint && !honeycombKey) {
    return null;
  }

  const headers = {
    ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS),
  };
  if (honeycombKey && headers["x-honeycomb-team"] === undefined) {
    headers["x-honeycomb-team"] = honeycombKey;
    const dataset = process.env.HONEYCOMB_DATASET;
    if (dataset) headers["x-honeycomb-dataset"] = dataset;
  }

  const endpoint =
    explicitTracesEndpoint ??
    appendTracePath(explicitBaseEndpoint ?? HONEYCOMB_DEFAULT_ENDPOINT);

  return new OtlpHttpTraceExporter(
    endpoint,
    headers,
    parseTimeout(process.env.OTEL_EXPORTER_OTLP_TRACES_TIMEOUT) ??
      parseTimeout(process.env.OTEL_EXPORTER_OTLP_TIMEOUT) ??
      DEFAULT_EXPORT_TIMEOUT_MS,
  );
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

function appendTracePath(baseEndpoint: string): string {
  const base = baseEndpoint.endsWith("/") ? baseEndpoint : `${baseEndpoint}/`;
  return new URL("v1/traces", base).toString();
}

function parseTimeout(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const timeout = Number(raw.trim());
  return Number.isFinite(timeout) && timeout > 0 ? timeout : undefined;
}

/**
 * Initializes a global tracer provider. Must be called before the rest of the
 * app boots. Safe to call when no exporter is configured (spans become cheap
 * no-ops). Idempotent.
 */
export function startTelemetry(options: StartTelemetryOptions): void {
  if (started) return;
  started = true;

  if (process.env.OTEL_LOG_LEVEL === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const exporter = resolveExporter();
  if (!exporter) {
    // No backend configured. Register a propagator + context manager anyway so
    // trace IDs still flow through logs and cross-service headers, but skip the
    // exporter entirely.
    const noopProvider = new NodeTracerProvider({
      resource: buildResource(options),
    });
    noopProvider.register({
      propagator: new W3CTraceContextPropagator(),
      contextManager: new AsyncLocalStorageContextManager(),
    });
    provider = noopProvider;
    return;
  }

  const processors: SpanProcessor[] = [new BatchSpanProcessor(exporter)];

  provider = new NodeTracerProvider({
    resource: buildResource(options),
    spanProcessors: processors,
  });

  provider.register({
    propagator: new W3CTraceContextPropagator(),
    contextManager: new AsyncLocalStorageContextManager(),
  });

  const shutdown = (signal: "SIGTERM" | "SIGINT") => {
    void provider
      ?.shutdown()
      .catch(() => {})
      .finally(() => {
        process.kill(process.pid, signal);
      });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function buildResource(options: StartTelemetryOptions): Resource {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? options.serviceName,
    [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.0.1",
    "deployment.environment": process.env.NODE_ENV ?? "development",
  });
}

export function shutdownTelemetry(): Promise<void> {
  return provider?.shutdown() ?? Promise.resolve();
}
