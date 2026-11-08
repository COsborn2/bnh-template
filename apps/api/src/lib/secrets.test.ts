import { describe, expect, test } from "bun:test";
import { secretsMatch } from "./secrets.js";

describe("secretsMatch", () => {
  test("matches only the exact secret", () => {
    expect(secretsMatch("s3cret-value", "s3cret-value")).toBe(true);
    expect(secretsMatch("s3cret-valuf", "s3cret-value")).toBe(false);
    expect(secretsMatch("S3cret-value", "s3cret-value")).toBe(false);
  });

  test("handles length mismatches without throwing", () => {
    expect(secretsMatch("s3cret", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret-value-and-more", "s3cret-value")).toBe(false);
    expect(secretsMatch("", "s3cret-value")).toBe(false);
  });

  test("a missing header never matches", () => {
    expect(secretsMatch(undefined, "s3cret-value")).toBe(false);
    expect(secretsMatch(null, "s3cret-value")).toBe(false);
  });
});
