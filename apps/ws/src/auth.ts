import { tracedFetch } from "@app/otel";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  sessionId: string;
}

const authUrl = process.env.WS_AUTH_URL;

if (!authUrl) {
  throw new Error("WS_AUTH_URL environment variable is required");
}

/** The API and WS disagree about the auth payload shape — a deploy mismatch
 *  or contract drift, not a client problem. Surface as 502, never as 401. */
export class WsAuthContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WsAuthContractError";
  }
}

/** The auth service could not be reached (restarting, network blip). Surface
 *  as 503 so clients retry instead of treating it as a rejected session. */
export class WsAuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WsAuthUnavailableError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function describePayload(value: unknown): string {
  if (!isRecord(value)) return typeof value;
  const keys = Object.keys(value).sort();
  return keys.length > 0 ? keys.join(",") : "(no keys)";
}

function normalizeAuthResult(payload: unknown): AuthResult | null {
  // better-auth's get-session returns a null body for anonymous requests —
  // that's a genuine "no session", not contract drift.
  if (payload === null || payload === undefined) return null;
  if (!isRecord(payload)) {
    throw new WsAuthContractError("WS auth response must be an object or null");
  }

  const session = payload.session;
  const user = payload.user;
  if (session == null && user == null) return null;
  if (!isRecord(session) || !isRecord(user)) {
    throw new WsAuthContractError(
      "WS auth response is missing session or user"
    );
  }

  const sessionId = optionalString(session.id);
  const userId = optionalString(user.id);
  if (!sessionId || !userId) {
    throw new WsAuthContractError(
      "WS auth response is missing session id or user id"
    );
  }

  return {
    sessionId,
    user: {
      id: userId,
      name: optionalString(user.name) ?? "Member",
      email: optionalString(user.email) ?? "",
    },
  };
}

/**
 * Resolves the browser session behind a WS upgrade request.
 *
 * Returns null only for genuine rejections (no session, 401/403/404). Throws
 * WsAuthUnavailableError for network errors and non-auth HTTP failures, and
 * WsAuthContractError when the API's payload shape doesn't match — so callers
 * can tell "this session is invalid, stop" from "the API is restarting, retry".
 */
export async function validateSession(
  cookieHeader: string
): Promise<AuthResult | null> {
  try {
    const response = await tracedFetch(authUrl!, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      return null;
    }
    if (!response.ok) {
      throw new WsAuthUnavailableError(
        `WS auth request failed with status ${response.status}`
      );
    }

    const payload: unknown = await response.json();
    try {
      return normalizeAuthResult(payload);
    } catch (error) {
      if (error instanceof WsAuthContractError) {
        throw new WsAuthContractError(
          `${error.message}; auth path=${new URL(authUrl!).pathname}; response keys=${describePayload(payload)}`
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof WsAuthContractError) throw error;
    if (error instanceof WsAuthUnavailableError) throw error;
    throw new WsAuthUnavailableError(
      error instanceof Error
        ? `WS auth request failed: ${error.message}`
        : "WS auth request failed"
    );
  }
}
