import { describe, expect, mock, test } from "bun:test";

mock.module("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  count: () => "count",
  desc: (...args: unknown[]) => ({ op: "desc", args }),
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  exists: (...args: unknown[]) => ({ op: "exists", args }),
  gt: (...args: unknown[]) => ({ op: "gt", args }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  inArray: (...args: unknown[]) => ({ op: "inArray", args }),
  isNotNull: (...args: unknown[]) => ({ op: "isNotNull", args }),
  isNull: (...args: unknown[]) => ({ op: "isNull", args }),
  lt: (...args: unknown[]) => ({ op: "lt", args }),
  ne: (...args: unknown[]) => ({ op: "ne", args }),
  notInArray: (...args: unknown[]) => ({ op: "notInArray", args }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings,
    values,
  }),
}));

mock.module("@app/db", () => ({
  db: {},
  close: () => Promise.resolve(),
  schema: {
    user: {
      emailVerified: "user.emailVerified",
      createdAt: "user.createdAt",
    },
    session: {
      expiresAt: "session.expiresAt",
    },
    verification: {
      expiresAt: "verification.expiresAt",
    },
  },
}));

const {
  expiredSessionCleanupWhere,
  expiredVerificationCleanupWhere,
  unverifiedAccountCleanupWhere,
} = await import("./cleanup-predicates.js");

describe("expiredSessionCleanupWhere", () => {
  test("matches sessions that expired before the cutoff", () => {
    const cutoff = new Date("2026-04-19T12:00:00.000Z");
    const predicate = expiredSessionCleanupWhere(cutoff) as unknown;

    expect(predicate).toEqual({
      op: "lt",
      args: ["session.expiresAt", cutoff],
    });
  });
});

describe("expiredVerificationCleanupWhere", () => {
  test("matches verification rows that expired before the cutoff", () => {
    const cutoff = new Date("2026-04-19T12:00:00.000Z");
    const predicate = expiredVerificationCleanupWhere(cutoff) as unknown;

    expect(predicate).toEqual({
      op: "lt",
      args: ["verification.expiresAt", cutoff],
    });
  });
});

describe("unverifiedAccountCleanupWhere", () => {
  test("matches unverified users older than the cutoff", () => {
    const cutoff = new Date("2026-04-19T12:00:00.000Z");
    const predicate = unverifiedAccountCleanupWhere(cutoff) as unknown;

    expect(predicate).toEqual({
      op: "and",
      conditions: [
        { op: "eq", args: ["user.emailVerified", false] },
        { op: "lt", args: ["user.createdAt", cutoff] },
      ],
    });
  });
});
