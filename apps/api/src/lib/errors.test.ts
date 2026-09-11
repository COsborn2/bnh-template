import { describe, expect, test } from "bun:test";
import { isUniqueViolation } from "./errors.js";

describe("isUniqueViolation", () => {
  test("detects a bare Postgres 23505 error", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  test("walks the cause chain drizzle wraps the driver error in", () => {
    const driverError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const wrapped = new Error("Failed query", { cause: driverError });

    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(new Error("outer", { cause: wrapped }))).toBe(
      true,
    );
  });

  test("is false for other codes and non-errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("plain"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
