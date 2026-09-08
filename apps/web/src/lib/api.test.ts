import { afterEach, describe, expect, test } from "bun:test";
import { jsonResponse, mockFetch, restoreFetch } from "@/test/fetch-mock";
import { ApiError, api } from "./api";

afterEach(restoreFetch);

describe("api", () => {
  test("returns parsed JSON for JSON responses", async () => {
    const calls = mockFetch(() => jsonResponse({ ok: true }));

    await expect(api("/test")).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["/api/test"]);
  });

  test("treats 204 responses as successful empty responses", async () => {
    mockFetch(() => new Response(null, { status: 204 }));

    await expect(api("/empty", { method: "POST" })).resolves.toBeUndefined();
  });

  test("treats empty success bodies as successful empty responses", async () => {
    mockFetch(() => new Response("", { status: 200 }));

    await expect(api("/empty")).resolves.toBeUndefined();
  });

  test("throws ApiError with server message on failed responses", async () => {
    mockFetch(() => jsonResponse({ error: "Nope" }, 400));

    await expect(api("/bad")).rejects.toEqual(new ApiError(400, "Nope"));
  });
});
