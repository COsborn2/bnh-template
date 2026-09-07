import { afterEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { jsonResponse, mockFetch, restoreFetch } from "@/test/fetch-mock";
import { proxy } from "./proxy";

afterEach(restoreFetch);

function pageRequest(cookie: string, extra: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie, ...extra },
  });
}

describe("proxy session refresh", () => {
  test("anonymous and cache-fresh requests never call the API", async () => {
    const calls = mockFetch(() => jsonResponse(null));

    await proxy(pageRequest(""));
    await proxy(
      pageRequest(
        "better-auth.session_token=tok; better-auth.session_data=jwe",
      ),
    );

    expect(calls).toEqual([]);
  });

  test("a token without a cache cookie refreshes via get-session and forwards Set-Cookie", async () => {
    const calls = mockFetch(
      () =>
        new Response(JSON.stringify({ user: { id: "u1" } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "better-auth.session_data=fresh; Max-Age=300; Path=/; HttpOnly",
          },
        }),
    );

    const response = await proxy(
      pageRequest("better-auth.session_token=tok", {
        "x-forwarded-for": "203.0.113.9",
      }),
    );

    expect(calls).toEqual(["http://localhost:3001/api/auth/get-session"]);
    expect(response.headers.getSetCookie()).toEqual([
      "better-auth.session_data=fresh; Max-Age=300; Path=/; HttpOnly",
    ]);
    // The refreshed cookie is spliced into the request this render sees.
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "better-auth.session_token=tok; better-auth.session_data=fresh",
    );
  });

  test("falls through when the API fails or sets nothing", async () => {
    mockFetch(() => jsonResponse(null, 500));
    const failed = await proxy(pageRequest("better-auth.session_token=tok"));
    expect(failed.headers.getSetCookie()).toEqual([]);

    mockFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const unreachable = await proxy(
      pageRequest("better-auth.session_token=tok"),
    );
    expect(unreachable.headers.getSetCookie()).toEqual([]);
  });
});
