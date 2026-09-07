import { describe, expect, test } from "bun:test";
import { describeDeleteError, describeLinkError } from "./errors";

describe("describeDeleteError", () => {
  test("rate limit wins over any code", () => {
    expect(describeDeleteError({ status: 429, code: "INVALID_PASSWORD" })).toBe(
      "Too many attempts. Please wait a little while and try again.",
    );
  });

  test("maps better-auth's credential codes", () => {
    expect(describeDeleteError({ code: "INVALID_PASSWORD" })).toBe(
      "Incorrect password. Please try again.",
    );
    expect(
      describeDeleteError({ code: "CREDENTIAL_ACCOUNT_NOT_FOUND" }),
    ).toContain("No password is set on this account");
  });

  test("falls back to the server message, then generic copy", () => {
    expect(describeDeleteError({ code: "OTHER", message: "Nope" })).toBe(
      "Nope",
    );
    expect(describeDeleteError({})).toBe(
      "Couldn't start account deletion. Please try again.",
    );
  });
});

describe("describeLinkError", () => {
  test("is empty without a code so nothing is shown", () => {
    expect(describeLinkError(null)).toBe("");
    expect(describeLinkError("")).toBe("");
  });

  test("maps better-auth's OAuth callback codes", () => {
    expect(describeLinkError("email_does_not_match")).toMatch(
      /uses a different email than your .+ account/,
    );
    expect(
      describeLinkError("account_already_linked_to_different_user"),
    ).toMatch(/already linked to another .+ account/);
    expect(describeLinkError("access_denied")).toBe(
      "Connecting was cancelled.",
    );
  });

  test("unknown codes get generic copy", () => {
    expect(describeLinkError("something_else")).toBe(
      "Connecting your Google account failed. Please try again.",
    );
  });
});
