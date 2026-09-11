/**
 * Process-global module mocks shared by the API test suites.
 *
 * `mock.module` is process-global and last-write-wins across every file in
 * one `bun test` run, and a module that already evaluated against a mock keeps
 * the export-name set it saw — so a stub that omits a name one suite's graph
 * needs is an import-time SyntaxError in whichever suite loads next. Keeping
 * the full export set here (instead of one hand-copied object per suite) is
 * what stops the sets drifting apart. Each suite still registers the mock
 * itself, passing handles for the exports it asserts on:
 *
 *   mock.module("../lib/redis.js", () => redisStub({ publishEvent }));
 *
 * A suite that must load the REAL module despite a sibling's mock imports it
 * as `./module.js?real` (see types/query-specifier-imports.d.ts).
 */
import { mock } from "bun:test";

type RedisLib = typeof import("../lib/redis.js");

/**
 * Every export of lib/redis.js as an inert mock: no client (so rate limits
 * use their in-memory fallback) and publishes that never reach Redis.
 */
export function redisStub(overrides: Partial<RedisLib> = {}): RedisLib {
  return {
    getRedisClient: mock(() => null),
    publishEvent: mock(() => {}),
    publishDisconnectUser: mock(() => {}),
    publishRevalidateTopic: mock(() => {}),
    ...overrides,
  } as RedisLib;
}
