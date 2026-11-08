import { describe, expect, test } from "bun:test";
import { decideSeed } from "./seed-guard.js";

const DEFAULT = "default-seed-password";
const LOCAL = "postgresql://postgres:postgres@localhost:5433/app";

describe("decideSeed", () => {
  test("a local database seeds with the default password, or SEED_USER_PASSWORD", () => {
    for (const url of [
      LOCAL,
      "postgresql://u@127.0.0.1:5432/app",
      "postgresql://u@[::1]:5432/app",
    ]) {
      expect(decideSeed({ DATABASE_URL: url }, DEFAULT)).toEqual({
        ok: true,
        password: DEFAULT,
        customPassword: false,
      });
    }
    expect(
      decideSeed({ DATABASE_URL: LOCAL, SEED_USER_PASSWORD: "mine" }, DEFAULT),
    ).toEqual({ ok: true, password: "mine", customPassword: true });
  });

  test("refuses a remote database, production, or Railway unless opted in", () => {
    const cases = [
      { DATABASE_URL: "postgresql://u@postgres.railway.internal:5432/railway" },
      { DATABASE_URL: "postgresql://u@roundhouse.proxy.rlwy.net:41234/railway" },
      { DATABASE_URL: LOCAL, NODE_ENV: "production" },
      { DATABASE_URL: LOCAL, RAILWAY_ENVIRONMENT_NAME: "production" },
      { DATABASE_URL: "not a url" },
    ];
    for (const env of cases) {
      const decision = decideSeed(env, DEFAULT);
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.reason).toContain("ALLOW_SEED=true");
    }
  });

  test("opting in still requires a password of its own", () => {
    const remote = {
      DATABASE_URL: "postgresql://u@db.example.com:5432/app",
      ALLOW_SEED: "true",
    };
    const refused = decideSeed(remote, DEFAULT);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("SEED_USER_PASSWORD");

    expect(
      decideSeed({ ...remote, SEED_USER_PASSWORD: "long-unique" }, DEFAULT),
    ).toEqual({ ok: true, password: "long-unique", customPassword: true });
  });

  test("ALLOW_SEED must be exactly true", () => {
    const decision = decideSeed(
      {
        DATABASE_URL: "postgresql://u@db.example.com/app",
        ALLOW_SEED: "1",
        SEED_USER_PASSWORD: "x",
      },
      DEFAULT,
    );
    expect(decision.ok).toBe(false);
  });
});
