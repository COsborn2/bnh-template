import { describe, expect, test } from "bun:test";
import { describeAuthCallbackError } from "./auth-errors";

describe("describeAuthCallbackError", () => {
  test("no code means no notice", () => {
    expect(describeAuthCallbackError(null)).toBe("");
    expect(describeAuthCallbackError("")).toBe("");
  });

  test("expired or replayed OAuth state", () => {
    const expected =
      "That sign-in attempt expired or was already used. Please sign in again.";
    expect(describeAuthCallbackError("state_mismatch")).toBe(expected);
    expect(describeAuthCallbackError("state_not_found")).toBe(expected);
  });

  test("user cancelled at the provider", () => {
    expect(describeAuthCallbackError("access_denied")).toBe(
      "Sign-in was cancelled. Please try again.",
    );
  });

  test("anything else gets the generic message", () => {
    expect(describeAuthCallbackError("unable_to_get_user_info")).toBe(
      "Something went wrong during sign-in. Please try again.",
    );
  });
});
