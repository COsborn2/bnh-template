import { afterEach, describe, expect, test } from "bun:test";
import { wsRoutes } from "./ws.js";

const SECRET = "ws-secret-for-tests";
const original = process.env.WS_API_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.WS_API_SECRET;
  else process.env.WS_API_SECRET = original;
});

function authorize(secret?: string): Promise<Response> {
  return Promise.resolve(
    wsRoutes.request("/authorize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret === undefined ? {} : { "X-WS-Secret": secret }),
      },
      body: JSON.stringify({ topic: "chat:general", userId: "u1" }),
    }),
  );
}

describe("WS internal routes' shared secret", () => {
  test("fail closed when no secret is configured", async () => {
    delete process.env.WS_API_SECRET;
    expect((await authorize(SECRET)).status).toBe(503);
    expect((await authorize()).status).toBe(503);
  });

  test("refuse a missing, wrong, or partial secret", async () => {
    process.env.WS_API_SECRET = SECRET;
    expect((await authorize()).status).toBe(403);
    expect((await authorize("nope")).status).toBe(403);
    expect((await authorize(SECRET.slice(0, -1))).status).toBe(403);
    expect((await authorize(`${SECRET}x`)).status).toBe(403);
  });

  test("let the exact secret through", async () => {
    process.env.WS_API_SECRET = SECRET;
    const res = await authorize(SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authorized: true });
  });
});
