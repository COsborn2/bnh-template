import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseNonNegativeInt,
  readEnumParam,
  readPagination,
} from "./pagination.js";

describe("parseNonNegativeInt", () => {
  test("falls back when the param is absent or empty", () => {
    expect(parseNonNegativeInt(undefined, 20)).toBe(20);
    expect(parseNonNegativeInt("", 20)).toBe(20);
  });

  test("parses integers", () => {
    expect(parseNonNegativeInt("0", 20)).toBe(0);
    expect(parseNonNegativeInt("40", 20)).toBe(40);
  });

  test("rejects negatives, fractions, and junk", () => {
    for (const value of ["-1", "1.5", "abc"]) {
      expect(() => parseNonNegativeInt(value, 20)).toThrow();
    }
  });
});

describe("readEnumParam", () => {
  const allowed = ["all", "new", "declined"] as const;

  test("falls back on missing or empty values", () => {
    expect(readEnumParam(undefined, allowed, "all")).toBe("all");
    expect(readEnumParam("", allowed, "all")).toBe("all");
  });

  test("passes through allowed values", () => {
    expect(readEnumParam("declined", allowed, "all")).toBe("declined");
  });

  test("rejects values outside the enum", () => {
    expect(() => readEnumParam("archived", allowed, "all")).toThrow();
  });
});

describe("readPagination", () => {
  test("defaults to the shared page size", () => {
    expect(readPagination({})).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  test("honours explicit values", () => {
    expect(readPagination({ limit: "5", offset: "10" })).toEqual({
      limit: 5,
      offset: 10,
    });
  });

  test("clamps the limit to the maximum", () => {
    expect(readPagination({ limit: "5000" }).limit).toBe(MAX_PAGE_SIZE);
  });

  test("accepts per-call overrides", () => {
    expect(
      readPagination({ limit: "50" }, { defaultLimit: 10, maxLimit: 25 }),
    ).toEqual({ limit: 25, offset: 0 });
  });
});
