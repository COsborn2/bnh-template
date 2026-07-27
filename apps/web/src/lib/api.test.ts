import { afterEach, describe, expect, mock, test } from "bun:test";
import { ApiError, api } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api", () => {
  test("returns parsed JSON for JSON responses", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(api("/test")).resolves.toEqual({ ok: true });
  });

  test("treats 204 responses as successful empty responses", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;

    await expect(api("/empty", { method: "POST" })).resolves.toBeUndefined();
  });

  test("treats empty success bodies as successful empty responses", async () => {
    globalThis.fetch = mock(
      async () => new Response("", { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(api("/empty")).resolves.toBeUndefined();
  });

  test("throws ApiError with server message on failed responses", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Nope" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(api("/bad")).rejects.toEqual(new ApiError(400, "Nope"));
  });
});
