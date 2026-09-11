import { describe, expect, test } from "bun:test";
import { resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  test("unset or blank means not configured", () => {
    expect(resolveSiteUrl(undefined)).toBeUndefined();
    expect(resolveSiteUrl("")).toBeUndefined();
    expect(resolveSiteUrl("   ")).toBeUndefined();
  });

  test("keeps an explicit scheme and drops the trailing slash", () => {
    expect(resolveSiteUrl("https://app.example.com/")).toBe(
      "https://app.example.com",
    );
    expect(resolveSiteUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  test("infers the scheme like the API does for BETTER_AUTH_URL", () => {
    expect(resolveSiteUrl("web-production.up.railway.app")).toBe(
      "https://web-production.up.railway.app",
    );
    expect(resolveSiteUrl("localhost:3000")).toBe("http://localhost:3000");
  });

  test("names the variable when the value cannot be parsed", () => {
    expect(() => resolveSiteUrl("https://")).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
