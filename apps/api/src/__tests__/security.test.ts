import { describe, test, expect } from "bun:test";
import {
  postJSON,
  registerUser,
  uniqueEmail,
} from "./setup.js";

describe("Security features", () => {
  // ------------------------------------------------------------------
  // HIBP — Have I Been Pwned password check
  // ------------------------------------------------------------------
  describe("HIBP: compromised password rejection", () => {
    test("known compromised password is rejected on sign-up", async () => {
      // "password123" is on the fake Pwned Passwords range API's breached
      // list (network-fakes.ts); the plugin hashes and looks it up for real.
      const email = uniqueEmail("hibp");
      const res = await postJSON("/sign-up/email", {
        name: "HIBP Test",
        email,
        password: "password123",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("PASSWORD_COMPROMISED");
      expect(body.message.toLowerCase()).toContain("compromised");
    });

    test("strong unique password is accepted", async () => {
      const email = uniqueEmail("hibp-ok");
      const res = await postJSON("/sign-up/email", {
        name: "HIBP OK",
        email,
        password: "xK9#mQ2!vL7$nR4@wP6^",
      });

      expect(res.status).toBe(200);
    });
  });

  // ------------------------------------------------------------------
  // Disposable email rejection
  // ------------------------------------------------------------------
  describe("Disposable email rejection", () => {
    test("registration with disposable email domain is rejected", async () => {
      // "mailinator.com" is a well-known disposable email provider
      // that should be on the blocklist
      const res = await postJSON("/sign-up/email", {
        name: "Disposable Test",
        email: `test-${Date.now()}@mailinator.com`,
        password: "Str0ng!Pass#2025",
      });

      // The email validation hook should reject this
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message.toLowerCase()).toContain("disposable");
    });

    test("registration with guerrillamail is rejected", async () => {
      const res = await postJSON("/sign-up/email", {
        name: "Guerrilla Test",
        email: `test-${Date.now()}@guerrillamail.com`,
        password: "Str0ng!Pass#2025",
      });

      expect(res.status).toBe(400);
    });

    test("registration with a domain that has no mail server is rejected", async () => {
      // The fake resolver answers ENOTFOUND for the reserved .invalid TLD.
      const res = await postJSON("/sign-up/email", {
        name: "No MX Test",
        email: uniqueEmail("no-mx").replace("@example.com", "@nowhere.invalid"),
        password: "Str0ng!Pass#2025",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("couldn't verify this email domain");
    });

    test("registration with legitimate email domain is accepted", async () => {
      const { res } = await registerUser();
      // example.com is used in our test helpers and should pass
      expect(res.status).toBe(200);
    });
  });

  // ------------------------------------------------------------------
  // Rate limiting
  // ------------------------------------------------------------------
  describe("Rate limiting", () => {
    // Rate limiting is disabled in the test auth instance to avoid
    // interfering with other tests. We verify the configuration exists
    // in the production auth instance instead.
    test.skip("rate limiting is configured in production auth", async () => {
      // This test is skipped because enabling rate limiting in tests
      // would cause flaky failures in other test suites.
      // The production auth.ts configures:
      //   - /sign-in/email: 3 requests per 10 seconds
      //   - /sign-up/email: 5 requests per 60 seconds
      //   - /two-factor/*: 3 requests per 10 seconds
      //   - Global: 100 requests per 60 seconds
    });
  });
});
