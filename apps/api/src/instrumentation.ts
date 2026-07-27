import { startTelemetry } from "@app/otel";

// Must run before the rest of the app boots so the global tracer provider and
// context manager are in place for the first request.
startTelemetry({ serviceName: "api" });
