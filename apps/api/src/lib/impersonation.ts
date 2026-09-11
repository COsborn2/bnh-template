import type { AuthUser } from "../middleware/auth.js";
import { forbidden } from "./errors.js";

/** Refuses consequential writes for better-auth admin impersonation
 *  sessions — see the `impersonatedBy` note on AuthUser. */
export function guardImpersonation(
  auth: Pick<AuthUser, "impersonatedBy">,
): void {
  if (auth.impersonatedBy) throw forbidden("Not available while impersonating");
}
