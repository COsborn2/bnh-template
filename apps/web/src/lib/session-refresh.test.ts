import { describe, expect, test } from "bun:test";
import {
  hasSessionToken,
  needsSessionRefresh,
  spliceRefreshedCookies,
} from "./session-refresh";

describe("hasSessionToken", () => {
  test("matches plain and secure-prefixed token cookies", () => {
    expect(
      hasSessionToken([{ name: "better-auth.session_token", value: "tok" }]),
    ).toBe(true);
    expect(
      hasSessionToken([
        { name: "__Secure-better-auth.session_token", value: "tok" },
      ]),
    ).toBe(true);
  });

  test("false for anonymous visitors and guests", () => {
    expect(hasSessionToken([])).toBe(false);
    expect(hasSessionToken([{ name: "other", value: "g" }])).toBe(false);
    // The JWE cache cookie alone is not a token.
    expect(
      hasSessionToken([{ name: "better-auth.session_data", value: "jwe" }]),
    ).toBe(false);
  });
});

describe("needsSessionRefresh", () => {
  test("true when token present but cache cookie missing", () => {
    expect(
      needsSessionRefresh([
        { name: "better-auth.session_token", value: "tok" },
      ]),
    ).toBe(true);
  });

  test("matches secure-prefixed cookie names", () => {
    expect(
      needsSessionRefresh([
        { name: "__Secure-better-auth.session_token", value: "tok" },
      ]),
    ).toBe(true);
    expect(
      needsSessionRefresh([
        { name: "__Secure-better-auth.session_token", value: "tok" },
        { name: "__Secure-better-auth.session_data", value: "jwe" },
      ]),
    ).toBe(false);
  });

  test("false when the cache cookie is still fresh", () => {
    expect(
      needsSessionRefresh([
        { name: "better-auth.session_token", value: "tok" },
        { name: "better-auth.session_data", value: "jwe" },
      ]),
    ).toBe(false);
  });

  test("false for anonymous visitors and guests", () => {
    expect(needsSessionRefresh([])).toBe(false);
    expect(needsSessionRefresh([{ name: "other", value: "g" }])).toBe(false);
  });
});

describe("spliceRefreshedCookies", () => {
  test("appends new cookies and keeps existing ones", () => {
    const header = spliceRefreshedCookies(
      [{ name: "better-auth.session_token", value: "tok" }],
      ["better-auth.session_data=jwe123; Max-Age=300; Path=/; HttpOnly"],
    );
    expect(header).toBe(
      "better-auth.session_token=tok; better-auth.session_data=jwe123",
    );
  });

  test("replaces same-name cookies with the refreshed value", () => {
    const header = spliceRefreshedCookies(
      [
        { name: "better-auth.session_token", value: "old" },
        { name: "theme", value: "dark" },
      ],
      ["better-auth.session_token=new; Path=/; HttpOnly"],
    );
    expect(header).toBe("theme=dark; better-auth.session_token=new");
  });

  test("keeps '=' inside cookie values intact", () => {
    const header = spliceRefreshedCookies(
      [],
      ["better-auth.session_data=abc=def==; Path=/"],
    );
    expect(header).toBe("better-auth.session_data=abc=def==");
  });

  test("ignores malformed set-cookie entries", () => {
    const header = spliceRefreshedCookies(
      [{ name: "a", value: "1" }],
      ["not-a-cookie", "=nameless; Path=/"],
    );
    expect(header).toBe("a=1");
  });
});
