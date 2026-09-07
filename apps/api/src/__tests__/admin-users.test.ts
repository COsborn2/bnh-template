/**
 * GET /api/admin/users — the app's own admin listing (routes/admin.ts) with
 * composable search/role/status/verified filters and a true total, driven
 * through the PRODUCTION Hono app so requireAuth resolves sessions with the
 * production auth instance (lib/auth.ts). Sessions are minted by the test
 * auth instance in setup.ts: both share DATABASE_URL and BETTER_AUTH_SECRET
 * (and the cookie name — both base URLs are plain http), so its signed
 * cookies verify here. Requires a real DATABASE_URL, as in CI.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import {
  createAndLoginUser,
  getSession,
  postJSON,
  registerUser,
  sessionCookieHeader,
  uniqueEmail,
} from "./setup.js";

process.env.BETTER_AUTH_SECRET ??=
  "test-secret-that-is-long-enough-for-validation";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";

const { app } = await import("../app.js");

interface AdminUsersResponse {
  users: Array<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    username: string | null;
    role: string;
    banned: boolean;
    banReason: string | null;
    banExpires: string | null;
    createdAt: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

async function listUsers(query: string, cookie?: string): Promise<Response> {
  return await app.request(`/api/admin/users${query}`, {
    headers: cookie ? { cookie } : {},
  });
}

async function listAsAdmin(
  query: string,
  cookie: string,
): Promise<AdminUsersResponse> {
  const res = await listUsers(query, cookie);
  expect(res.status).toBe(200);
  return (await res.json()) as AdminUsersResponse;
}

describe("GET /api/admin/users", () => {
  let adminCookie: string;
  // A marker unique to this run, present in both the name
  // ("Filter <stamp> …") and the email ("filter-<stamp>-…@example.com"), so
  // search can be exercised against each column separately.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let bannedId: string;
  let activeId: string;
  let unverifiedId: string;

  beforeAll(async () => {
    const admin = await createAndLoginUser({
      email: uniqueEmail("admin"),
      name: "Admin User",
      role: "admin",
    });
    adminCookie = admin.cookieHeader;

    const banned = await createAndLoginUser({
      email: uniqueEmail(`filter-${stamp}`),
      name: `Filter ${stamp} Banned`,
    });
    bannedId = banned.user.id;
    const banRes = await postJSON(
      "/admin/ban-user",
      { userId: bannedId, banReason: "spam" },
      { cookie: adminCookie },
    );
    expect(banRes.status).toBe(200);

    const active = await createAndLoginUser({
      email: uniqueEmail(`filter-${stamp}`),
      name: `Filter ${stamp} Active`,
    });
    activeId = active.user.id;

    // Sign-up through the test auth instance leaves emailVerified false.
    const unverified = await registerUser({
      email: uniqueEmail(`filter-${stamp}`),
      name: `Filter ${stamp} Unverified`,
    });
    expect(unverified.sessionToken).toBeTruthy();
    const { data } = await getSession(unverified.sessionToken!);
    unverifiedId = data.user.id;
  });

  test("anonymous requests get 401", async () => {
    const res = await listUsers("");
    expect(res.status).toBe(401);
  });

  test("non-admins get 403", async () => {
    const reg = await registerUser();
    expect(reg.sessionToken).toBeTruthy();

    const res = await listUsers("", sessionCookieHeader(reg.sessionToken!));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Admin only" });
  });

  test("admins get a page with the default size, a true total and ISO dates", async () => {
    const body = await listAsAdmin("", adminCookie);

    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.users.length).toBeLessThanOrEqual(20);
    expect(body.users.length).toBeGreaterThan(0);
    for (const user of body.users) {
      expect(typeof user.id).toBe("string");
      expect(typeof user.email).toBe("string");
      expect(typeof user.emailVerified).toBe("boolean");
      expect(typeof user.banned).toBe("boolean");
      expect(typeof user.role).toBe("string");
      expect(Number.isNaN(Date.parse(user.createdAt))).toBe(false);
      if (user.banExpires !== null) {
        expect(Number.isNaN(Date.parse(user.banExpires))).toBe(false);
      }
    }
  });

  test("search matches name OR email, case-insensitively", async () => {
    const expectedIds = [bannedId, activeId, unverifiedId].sort();

    // Space-separated: only the names contain it.
    const byName = await listAsAdmin(
      `?search=${encodeURIComponent(`filter ${stamp}`)}`,
      adminCookie,
    );
    expect(byName.total).toBe(3);
    expect(byName.users.map((u) => u.id).sort()).toEqual(expectedIds);

    // Dash-separated and upper-cased: only the emails contain it.
    const byEmail = await listAsAdmin(`?search=FILTER-${stamp}`, adminCookie);
    expect(byEmail.total).toBe(3);
    expect(byEmail.users.map((u) => u.id).sort()).toEqual(expectedIds);
  });

  test("composes role, status and verified filters with a matching total", async () => {
    const base = `?search=filter-${stamp}`;

    const banned = await listAsAdmin(
      `${base}&role=user&status=banned`,
      adminCookie,
    );
    expect(banned.total).toBe(1);
    expect(banned.users).toHaveLength(1);
    expect(banned.users[0]!.id).toBe(bannedId);
    expect(banned.users[0]!.banned).toBe(true);
    expect(banned.users[0]!.banReason).toBe("spam");

    const active = await listAsAdmin(
      `${base}&status=active&verified=verified`,
      adminCookie,
    );
    expect(active.total).toBe(1);
    expect(active.users[0]!.id).toBe(activeId);

    const unverified = await listAsAdmin(
      `${base}&verified=unverified`,
      adminCookie,
    );
    expect(unverified.total).toBe(1);
    expect(unverified.users[0]!.id).toBe(unverifiedId);
    expect(unverified.users[0]!.emailVerified).toBe(false);

    const admins = await listAsAdmin(`${base}&role=admin`, adminCookie);
    expect(admins.total).toBe(0);
    expect(admins.users).toEqual([]);
  });

  test("paginates: empty params fall back, oversize limits clamp, offset is honoured", async () => {
    const defaults = await listAsAdmin("?limit=&offset=", adminCookie);
    expect(defaults.limit).toBe(20);
    expect(defaults.offset).toBe(0);

    const clamped = await listAsAdmin("?limit=5000", adminCookie);
    expect(clamped.limit).toBe(100);

    const page = await listAsAdmin(
      `?search=filter-${stamp}&limit=1&offset=1`,
      adminCookie,
    );
    expect(page.users).toHaveLength(1);
    expect(page.total).toBe(3);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(1);
  });

  test("rejects invalid filter and pagination params with 400", async () => {
    for (const query of [
      "?role=superuser",
      "?status=deleted",
      "?verified=maybe",
      "?limit=abc",
      "?limit=1.5",
      "?offset=-1",
    ]) {
      const res = await listUsers(query, adminCookie);
      expect(res.status).toBe(400);
    }
  });
});
