import { describe, test, expect, beforeAll } from "bun:test";
import {
  postJSON,
  getJSON,
  registerUser,
  signIn,
  getSession,
  uniqueEmail,
  extractSessionCookie,
  sessionCookieHeader,
} from "./setup.js";

describe("Core auth flows", () => {
  // ------------------------------------------------------------------
  // Registration
  // ------------------------------------------------------------------
  describe("Registration", () => {
    test("register with email/password returns user and token", async () => {
      const email = uniqueEmail("register");
      const res = await postJSON("/sign-up/email", {
        name: "Alice",
        email,
        password: "Str0ng!Pass#2025",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(email);
      expect(body.user.name).toBe("Alice");
      expect(body.token).toBeTruthy();
      // Session cookie should be set
      expect(extractSessionCookie(res)).toBeTruthy();
    });

    test("register with existing email returns 422", async () => {
      const email = uniqueEmail("dup");
      // Register once
      await postJSON("/sign-up/email", {
        name: "First",
        email,
        password: "Str0ng!Pass#2025",
      });
      // Register again with the same email
      const res = await postJSON("/sign-up/email", {
        name: "Second",
        email,
        password: "Str0ng!Pass#2025",
      });

      // better-auth returns 422 for duplicate emails
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
    });
  });

  // ------------------------------------------------------------------
  // Login
  // ------------------------------------------------------------------
  describe("Login", () => {
    const loginEmail = uniqueEmail("login");
    const loginPassword = "Str0ng!Pass#2025";

    beforeAll(async () => {
      await registerUser({ email: loginEmail, password: loginPassword });
    });

    test("login with correct credentials returns user and token", async () => {
      const { res, data, sessionToken } = await signIn(
        loginEmail,
        loginPassword,
      );

      expect(res.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(loginEmail);
      expect(data.token).toBeTruthy();
      expect(sessionToken).toBeTruthy();
    });

    test("login with wrong password returns error", async () => {
      const { res } = await signIn(loginEmail, "WrongPassword!123");

      expect(res.status).not.toBe(200);
    });

    test("login with non-existent email returns error", async () => {
      const { res } = await signIn("nonexistent@example.com", "SomePass!123");

      expect(res.status).not.toBe(200);
    });
  });

  // ------------------------------------------------------------------
  // Session
  // ------------------------------------------------------------------
  describe("Session", () => {
    test("get session with valid cookie returns user and session", async () => {
      const { sessionToken, email } = await registerUser();
      expect(sessionToken).toBeTruthy();

      const { res, data } = await getSession(sessionToken!);
      expect(res.status).toBe(200);
      expect(data).not.toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(data.session).toBeDefined();
      expect(data.session.token).toBeTruthy();
    });

    test("get session without cookie returns null", async () => {
      const res = await getJSON("/get-session");
      expect(res.status).toBe(200);
      const data = await res.json();
      // better-auth returns null body when no session
      expect(data).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------------
  describe("Logout", () => {
    test("logout invalidates session", async () => {
      const { sessionToken } = await registerUser();
      expect(sessionToken).toBeTruthy();

      // Logout
      const logoutRes = await postJSON("/sign-out", {}, {
        cookie: sessionCookieHeader(sessionToken!),
      });
      expect(logoutRes.status).toBe(200);
      const logoutBody = await logoutRes.json();
      expect(logoutBody.success).toBe(true);

      // Session should no longer be valid
      const afterRes = await getJSON("/get-session", {
        cookie: sessionCookieHeader(sessionToken!),
      });
      expect(afterRes.status).toBe(200);
      const afterBody = await afterRes.json();
      // After logout, get-session returns null
      expect(afterBody).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // Email verification flow
  // ------------------------------------------------------------------
  describe("Email verification", () => {
    test("newly registered user is signed in (verification not required in test)", async () => {
      const { sessionToken, email } = await registerUser();
      expect(sessionToken).toBeTruthy();

      const { data } = await getSession(sessionToken!);
      expect(data).not.toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      // emailVerified is false until explicitly verified, but user can still sign in
      // because requireEmailVerification is false in test config
      expect(typeof data.user.emailVerified).toBe("boolean");
    });
  });

  // ------------------------------------------------------------------
  // Password reset flow
  // ------------------------------------------------------------------
  describe("Password reset", () => {
    test("request password reset for existing email returns 200", async () => {
      const { email } = await registerUser();

      const res = await postJSON("/request-password-reset", {
        email,
        redirectTo: "http://localhost:3000/reset-password",
      });

      expect(res.status).toBe(200);
    });

    test("request password reset for non-existent email returns 200", async () => {
      const res = await postJSON("/request-password-reset", {
        email: "nonexistent-reset@example.com",
        redirectTo: "http://localhost:3000/reset-password",
      });

      // better-auth returns 200 to prevent email enumeration
      expect(res.status).toBe(200);
    });
  });
});
