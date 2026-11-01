/**
 * GET/PUT /api/account/avatar and the sign-up hook that gives every new
 * account a random bot, driven through the PRODUCTION Hono app and auth
 * instance. Requires a real DATABASE_URL, as in CI.
 */

import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@app/db";
import { user as userTable } from "@app/db/schema";
import { parseAvatarOptions, renderAvatarSvg, type AvatarOptions } from "@app/shared";
import { createAndLoginUser, uniqueEmail } from "./setup.js";

process.env.BETTER_AUTH_SECRET ??=
  "test-secret-that-is-long-enough-for-validation";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";

const { app } = await import("../app.js");
const { auth } = await import("../lib/auth.js");

const PICK: AvatarOptions = {
  shape: "tv",
  color: "green",
  background: "charcoal",
  eyes: "visor",
  mouth: "grill",
  top: "twin",
  extra: "bolts",
};

async function request(method: "GET" | "PUT", cookie?: string, body?: unknown): Promise<Response> {
  return await app.request("/api/account/avatar", {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function storedAvatar(email: string) {
  const [row] = await db
    .select({ avatarOptions: userTable.avatarOptions, avatarSvg: userTable.avatarSvg })
    .from(userTable)
    .where(eq(userTable.email, email));
  return row;
}

describe("/api/account/avatar", () => {
  test("anonymous requests get 401", async () => {
    expect((await request("GET")).status).toBe(401);
    expect((await request("PUT", undefined, PICK)).status).toBe(401);
  });

  test("GET repairs an account with no avatar yet and saves the result", async () => {
    const email = uniqueEmail("avatar-get");
    const user = await createAndLoginUser({ email });

    const res = await request("GET", user.cookieHeader);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options: AvatarOptions; svg: string };
    expect(parseAvatarOptions(body.options)).toEqual(body.options);
    expect(body.svg).toBe(renderAvatarSvg(body.options));

    const stored = await storedAvatar(email);
    expect(stored.avatarOptions).toEqual(body.options);
    expect(stored.avatarSvg).toBe(body.svg);

    const again = (await (await request("GET", user.cookieHeader)).json()) as { options: AvatarOptions };
    expect(again.options).toEqual(body.options);
  });

  test("PUT renders and saves the chosen options", async () => {
    const email = uniqueEmail("avatar-put");
    const user = await createAndLoginUser({ email });

    const res = await request("PUT", user.cookieHeader, PICK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ options: PICK, svg: renderAvatarSvg(PICK) });
    expect((await storedAvatar(email)).avatarOptions).toEqual(PICK);
  });

  test("PUT rejects anything but the seven known option ids", async () => {
    const user = await createAndLoginUser({ email: uniqueEmail("avatar-bad") });

    for (const body of [
      { ...PICK, eyes: "laser" },
      { ...PICK, svg: "<svg><script>alert(1)</script></svg>" },
      { backgroundColor: ["1e88e5"], eyes: ["happy"], mouth: ["smile01"] },
      {},
      "not json",
    ]) {
      const res = await request("PUT", user.cookieHeader, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid avatar options" });
    }
  });
});

describe("sign-up", () => {
  test("a new account starts with a random bot", async () => {
    const email = uniqueEmail("avatar-signup");
    await auth.api.signUpEmail({
      body: { email, password: "Avatar-Signup!Xy7#Local", name: "Avatar Signup" },
    });

    const stored = await storedAvatar(email);
    const options = parseAvatarOptions(stored.avatarOptions);
    expect(options).not.toBeNull();
    expect(stored.avatarSvg).toBe(renderAvatarSvg(options!));
  });
});
