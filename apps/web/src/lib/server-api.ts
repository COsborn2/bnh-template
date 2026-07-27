import "server-only";
import { cookies, headers } from "next/headers";

// Server components talk to the API directly over the internal network —
// the same env var the /api rewrite uses, so dev needs no extra setup.
const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL || "http://localhost:3001";

export class ServerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

/**
 * Fetch from the API on behalf of the current request. The incoming request's
 * cookies (the better-auth session cookie) are forwarded verbatim, so the API
 * resolves the viewer exactly as it would for a browser call. Responses are
 * viewer-specific and must never be cached.
 */
export async function serverApi<T = unknown>(path: string): Promise<T> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const forwarded: Record<string, string> = {};
  const cookieHeader = cookieStore.toString();
  if (cookieHeader) forwarded.cookie = cookieHeader;
  // Preserve the caller's IP for the API's rate limiting and logging (the API
  // reads x-real-ip / x-forwarded-for). These arrive on the page request from
  // the same edge proxy that sets them on direct browser API calls, so
  // forwarding them verbatim keeps the API's trust model intact — without
  // them every SSR fetch would appear to come from the web container.
  const xff = headerStore.get("x-forwarded-for");
  if (xff) forwarded["x-forwarded-for"] = xff;
  const realIp = headerStore.get("x-real-ip");
  if (realIp) forwarded["x-real-ip"] = realIp;

  const res = await fetch(`${API_INTERNAL_URL}/api${path}`, {
    headers: forwarded,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      typeof body.error === "string"
        ? body.error
        : (body.error?.issues?.[0]?.message ?? "Request failed");
    throw new ServerApiError(res.status, message);
  }

  return (await res.json()) as T;
}

/**
 * Where to send a viewer who can't see the resource they navigated to:
 * signed-in viewers who lost access go home, anonymous visitors go sign in.
 * The cookie check is a heuristic — better-auth's session cookie name
 * contains "session_token" in every configuration we run.
 */
export async function noAccessRedirectPath(): Promise<
  "/dashboard" | "/auth/login"
> {
  const cookieStore = await cookies();
  const looksAuthenticated = cookieStore
    .getAll()
    .some((c) => c.name.includes("session_token"));
  return looksAuthenticated ? "/dashboard" : "/auth/login";
}

/** Like `serverApi`, but returns null when the viewer can't see the resource. */
export async function serverApiOrNull<T = unknown>(
  path: string,
): Promise<T | null> {
  try {
    return await serverApi<T>(path);
  } catch (err) {
    if (
      err instanceof ServerApiError &&
      (err.status === 401 || err.status === 403 || err.status === 404)
    ) {
      return null;
    }
    throw err;
  }
}
