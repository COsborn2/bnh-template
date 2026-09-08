import { describe, expect, test } from "bun:test";
import { HTTPException } from "hono/http-exception";
import { guardImpersonation } from "./impersonation.js";

describe("guardImpersonation", () => {
  test("passes for a regular session", () => {
    expect(() => guardImpersonation({ impersonatedBy: null })).not.toThrow();
  });

  test("throws a 403 for an admin impersonation session", () => {
    try {
      guardImpersonation({ impersonatedBy: "admin-1" });
      throw new Error("Expected guardImpersonation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HTTPException);
      const exception = err as HTTPException;
      expect(exception.status).toBe(403);
      expect(exception.message).toBe("Not available while impersonating");
    }
  });
});
