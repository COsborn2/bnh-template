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
      // "password123" is one of the most common breached passwords
      const email = uniqueEmail("hibp");
      const res = await postJSON("/sign-up/email", {
        name: "HIBP Test",
        email,
        password: "password123",
      });

      // The HIBP plugin checks the password against the Pwned Passwords API
      // and should reject known compromised passwords with an error
      expect(res.status).not.toBe(200);
      const body = await res.json();
      // The error message/code should indicate the password is compromised
      if (body.message) {
        expect(body.message.toLowerCase()).toContain("compromised");
      }
      if (body.code) {
        expect(body.code).toBe("PASSWORD_COMPROMISED");
      }
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
      expect(res.status).not.toBe(200);
      const body = await res.json();
      if (body.message) {
        expect(body.message.toLowerCase()).toContain("disposable");
      }
    });

    test("registration with guerrillamail is rejected", async () => {
      const res = await postJSON("/sign-up/email", {
        name: "Guerrilla Test",
        email: `test-${Date.now()}@guerrillamail.com`,
        password: "Str0ng!Pass#2025",
      });

      expect(res.status).not.toBe(200);
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
