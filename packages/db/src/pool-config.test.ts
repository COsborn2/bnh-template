import { describe, expect, test } from "bun:test";
import { parse } from "pg-connection-string";
import { buildPoolConfig, withLibpqSslSemantics } from "./pool-config.js";

const RAILWAY_URL = "postgresql://u:p@postgres.railway.internal:5432/railway";

describe("withLibpqSslSemantics", () => {
  test("sslmode=require keeps libpq's meaning: encrypt, don't verify the certificate", () => {
    const url = withLibpqSslSemantics(`${RAILWAY_URL}?sslmode=require`);
    expect(new URL(url).searchParams.get("uselibpqcompat")).toBe("true");
    expect(parse(url).ssl).toEqual({ rejectUnauthorized: false });
  });

  test("without the flag node-postgres would verify (the behaviour this guards against)", () => {
    const ssl = parse(`${RAILWAY_URL}?sslmode=require`).ssl;
    expect(ssl).not.toEqual({ rejectUnauthorized: false });
  });

  test("URLs without sslmode, or that already choose, pass through untouched", () => {
    expect(withLibpqSslSemantics(RAILWAY_URL)).toBe(RAILWAY_URL);
    const chosen =
      "postgresql://u:p@h/db?sslmode=verify-full&uselibpqcompat=false";
    expect(withLibpqSslSemantics(chosen)).toBe(chosen);
    expect(withLibpqSslSemantics("not a url")).toBe("not a url");
  });
});

describe("buildPoolConfig", () => {
  test("pool size from DB_POOL_SIZE, idle connections kept warm, recycled, keepalive on", () => {
    const config = buildPoolConfig({
      DATABASE_URL: "postgresql://u@h/db",
      DB_POOL_SIZE: "25",
    });
    expect(config).toMatchObject({
      connectionString: "postgresql://u@h/db",
      max: 25,
      idleTimeoutMillis: 300_000,
      maxLifetimeSeconds: 1800,
      keepAlive: true,
    });
  });

  test("default pool size stays 10", () => {
    expect(
      buildPoolConfig({ DATABASE_URL: "postgresql://u@h/db" }).max,
    ).toBe(10);
  });
});
