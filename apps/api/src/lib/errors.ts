import { HTTPException } from "hono/http-exception";

export function unauthorized(message = "Unauthorized") {
  return new HTTPException(401, { message });
}

export function forbidden(message = "Forbidden") {
  return new HTTPException(403, { message });
}

export function notFound(message = "Not found") {
  return new HTTPException(404, { message });
}

export function badRequest(message = "Bad request") {
  return new HTTPException(400, { message });
}

export function conflict(message = "Conflict") {
  return new HTTPException(409, { message });
}

export function unprocessable(message = "Unprocessable Entity") {
  return new HTTPException(422, { message });
}

export function payloadTooLarge(message = "Payload too large") {
  return new HTTPException(413, { message });
}

export function tooManyRequests(message = "Too many requests") {
  return new HTTPException(429, { message });
}

/** True when `err` is a Postgres unique-constraint violation (SQLSTATE
 *  23505), directly or wrapped by drizzle in a `cause` chain. Lets routes
 *  lean on a UNIQUE index as the race arbiter and map the loser to a 409. */
export function isUniqueViolation(err: unknown): boolean {
  for (
    let e = err;
    e && typeof e === "object";
    e = (e as { cause?: unknown }).cause
  ) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
