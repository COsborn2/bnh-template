import { describe, test, expect } from "bun:test";
import { buildVerificationUrl } from "../lib/auth.js";

describe("buildVerificationUrl", () => {
  test("adds callbackURL when not present", () => {
    const input = "https://example.com/api/auth/verify-email?token=abc123";
    const result = buildVerificationUrl(input);
    const url = new URL(result);

    expect(url.searchParams.get("callbackURL")).toBe("/dashboard");
    expect(url.searchParams.get("token")).toBe("abc123");
  });

  test("replaces existing callbackURL instead of duplicating", () => {
    const input =
      "https://example.com/api/auth/verify-email?token=abc123&callbackURL=/evil";
    const result = buildVerificationUrl(input);
    const url = new URL(result);

    expect(url.searchParams.get("callbackURL")).toBe("/dashboard");
    // Ensure there's only one callbackURL param
    expect(url.searchParams.getAll("callbackURL")).toEqual(["/dashboard"]);
    expect(url.searchParams.get("token")).toBe("abc123");
  });

  test("preserves all other query parameters", () => {
    const input =
      "https://example.com/api/auth/verify-email?token=xyz&foo=bar&baz=qux";
    const result = buildVerificationUrl(input);
    const url = new URL(result);

    expect(url.searchParams.get("token")).toBe("xyz");
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get("baz")).toBe("qux");
    expect(url.searchParams.get("callbackURL")).toBe("/dashboard");
  });
});
