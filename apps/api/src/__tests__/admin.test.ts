import { describe, test, expect, beforeAll } from "bun:test";
import {
  postJSON,
  getJSON,
  registerUser,
  signIn,
  getSession,
  sessionCookieHeader,
  uniqueEmail,
  createAndLoginUser,
} from "./setup.js";

describe("Admin plugin", () => {
  let adminCookie: string;

  beforeAll(async () => {
    // Create an admin user via testUtils (directly in DB with role=admin)
    const adminResult = await createAndLoginUser({
      email: uniqueEmail("admin"),
      name: "Admin User",
      role: "admin",
    });
    adminCookie = adminResult.cookieHeader;
  });

  // ------------------------------------------------------------------
  // List users
  // ------------------------------------------------------------------
  describe("List users", () => {
    test("admin can list users", async () => {
      const res = await getJSON("/admin/list-users", {
        cookie: adminCookie,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.users).toBeDefined();
      expect(Array.isArray(body.users)).toBe(true);
      expect(body.users.length).toBeGreaterThan(0);
    });

    test("non-admin cannot list users", async () => {
      const reg = await registerUser();
      expect(reg.sessionToken).toBeTruthy();

      const res = await getJSON("/admin/list-users", {
        cookie: sessionCookieHeader(reg.sessionToken!),
      });

      // Should be forbidden
      expect(res.status).not.toBe(200);
    });
  });

  // ------------------------------------------------------------------
  // Ban / unban
  // ------------------------------------------------------------------
  describe("Ban and unban", () => {
    test("admin can ban a user, preventing login", async () => {
      // Create a regular user
      const reg = await registerUser();
      const { data: sessionData } = await getSession(reg.sessionToken!);
      const userId = sessionData.user.id;

      // Admin bans the user
      const banRes = await postJSON(
        "/admin/ban-user",
        {
          userId,
          banReason: "test ban",
        },
        { cookie: adminCookie },
      );
      expect(banRes.status).toBe(200);

      // User should no longer be able to sign in
      const { res: signInRes } = await signIn(reg.email, reg.password);
      // better-auth returns an error for banned users
      expect(signInRes.status).not.toBe(200);
    });

    test("admin can unban a user, allowing login again", async () => {
      // Create and register a user
      const reg = await registerUser();
      const { data: sessionData } = await getSession(reg.sessionToken!);
      const userId = sessionData.user.id;

      // Ban the user
      await postJSON(
        "/admin/ban-user",
        { userId },
        { cookie: adminCookie },
      );

      // Unban the user
      const unbanRes = await postJSON(
        "/admin/unban-user",
        { userId },
        { cookie: adminCookie },
      );
      expect(unbanRes.status).toBe(200);

      // User should be able to sign in again
      const { res: signInRes, data } = await signIn(
        reg.email,
        reg.password,
      );
      expect(signInRes.status).toBe(200);
      expect(data.user).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // Non-admin access
  // ------------------------------------------------------------------
  describe("Non-admin access denied", () => {
    test("non-admin cannot ban a user", async () => {
      const reg = await registerUser();
      const target = await registerUser();
      const { data: targetSession } = await getSession(target.sessionToken!);

      const res = await postJSON(
        "/admin/ban-user",
        { userId: targetSession.user.id },
        { cookie: sessionCookieHeader(reg.sessionToken!) },
      );

      expect(res.status).not.toBe(200);
    });

    test("non-admin cannot set roles", async () => {
      const reg = await registerUser();
      const target = await registerUser();
      const { data: targetSession } = await getSession(target.sessionToken!);

      const res = await postJSON(
        "/admin/set-role",
        { userId: targetSession.user.id, role: "admin" },
        { cookie: sessionCookieHeader(reg.sessionToken!) },
      );

      expect(res.status).not.toBe(200);
    });
  });
});
