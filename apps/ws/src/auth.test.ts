import { describe, expect, test } from "bun:test";

// auth.ts refuses to load without WS_AUTH_URL, so set it before importing.
process.env.WS_AUTH_URL ??= "http://localhost:3001/api/auth/get-session";
const { sessionRequestHeaders } = await import("./auth.js");

describe("sessionRequestHeaders", () => {
  test("forwards the proxy's client IP headers alongside the cookie", () => {
    const upgrade = new Headers({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "203.0.113.7",
      "user-agent": "irrelevant",
    });
    expect(sessionRequestHeaders("session=abc", upgrade)).toEqual({
      cookie: "session=abc",
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "203.0.113.7",
    });
  });

  test("sends only the cookie when the upgrade carried no IP headers", () => {
    expect(sessionRequestHeaders("session=abc", new Headers())).toEqual({
      cookie: "session=abc",
    });
    expect(sessionRequestHeaders("session=abc")).toEqual({
      cookie: "session=abc",
    });
  });
});
