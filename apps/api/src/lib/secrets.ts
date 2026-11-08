import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a presented shared secret (a service-to-service header, say)
 * matches the expected one, compared in constant time. `===` returns at the
 * first differing character, so its timing hints at how much of a guess was
 * right. Both sides are hashed first: timingSafeEqual needs equal lengths,
 * and checking the length up front would leak it.
 */
export function secretsMatch(
  presented: string | null | undefined,
  expected: string,
): boolean {
  if (typeof presented !== "string") return false;
  return timingSafeEqual(
    createHash("sha256").update(presented).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
