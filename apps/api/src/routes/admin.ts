import { Hono } from "hono";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, schema } from "@app/db";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { forbidden } from "../lib/errors.js";
import { readEnumParam, readPagination } from "../lib/pagination.js";

export const adminRoutes = new Hono<{
  Variables: { auth: AuthUser };
}>();

// The app's own user listing. better-auth's /auth/admin/list-users accepts a
// single filterField per call, so combined role/status/verified filters and
// a correct `total` need a query of our own; ban/unban/impersonate/remove
// keep using better-auth's admin endpoints.
adminRoutes.get("/users", requireAuth, async (c) => {
  const auth = c.get("auth");
  if (auth.role !== "admin") throw forbidden("Admin only");

  const { limit, offset } = readPagination({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const search = c.req.query("search")?.trim();
  const role = readEnumParam(
    c.req.query("role"),
    ["all", "admin", "user"],
    "all",
  );
  const status = readEnumParam(
    c.req.query("status"),
    ["all", "active", "banned"],
    "all",
  );
  const verified = readEnumParam(
    c.req.query("verified"),
    ["all", "verified", "unverified"],
    "all",
  );

  const filters: SQL[] = [];
  if (search) {
    const pattern = `%${search}%`;
    const searchFilter = or(
      ilike(schema.user.name, pattern),
      ilike(schema.user.email, pattern),
    );
    if (searchFilter) filters.push(searchFilter);
  }
  if (role !== "all") {
    filters.push(eq(schema.user.role, role));
  }
  if (status !== "all") {
    filters.push(eq(schema.user.banned, status === "banned"));
  }
  if (verified !== "all") {
    filters.push(eq(schema.user.emailVerified, verified === "verified"));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [users, [totalRow]] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        emailVerified: schema.user.emailVerified,
        username: schema.user.username,
        role: schema.user.role,
        banned: schema.user.banned,
        banReason: schema.user.banReason,
        banExpires: schema.user.banExpires,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(schema.user).where(where),
  ]);

  return c.json({
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      banExpires: user.banExpires?.toISOString() ?? null,
    })),
    total: totalRow?.total ?? 0,
    limit,
    offset,
  });
});
