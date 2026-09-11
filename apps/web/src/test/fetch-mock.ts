import { mock } from "bun:test";

/** Shared `globalThis.fetch` stand-in for store tests. `mockFetch` routes every
 *  request through `handler` and returns the list of URLs requested so far;
 *  `restoreFetch` puts the real fetch back (call it from `afterEach`). */

const originalFetch = globalThis.fetch;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function mockFetch(
  handler: (url: string) => Response | Promise<Response>,
): string[] {
  const calls: string[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push(url);
    return handler(url);
  }) as unknown as typeof fetch;
  return calls;
}

export function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}
