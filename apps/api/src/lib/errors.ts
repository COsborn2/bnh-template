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
