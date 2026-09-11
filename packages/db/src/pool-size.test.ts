import { describe, expect, test } from "bun:test";
import { DEFAULT_POOL_SIZE, parsePoolSize } from "./pool-size.js";

describe("parsePoolSize", () => {
  test("keeps postgres-js's default when unset or blank", () => {
    expect(parsePoolSize(undefined)).toBe(DEFAULT_POOL_SIZE);
    expect(parsePoolSize("")).toBe(10);
    expect(parsePoolSize("   ")).toBe(10);
  });

  test("accepts a positive integer, trimmed", () => {
    expect(parsePoolSize("25")).toBe(25);
    expect(parsePoolSize(" 1 ")).toBe(1);
  });

  test("fails fast on zero, negatives, fractions and junk", () => {
    for (const raw of ["0", "-1", "1.5", "abc", "10x"]) {
      expect(() => parsePoolSize(raw)).toThrow(
        /DB_POOL_SIZE must be a positive integer/,
      );
    }
  });
});
