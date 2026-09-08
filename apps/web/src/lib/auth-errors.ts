/**
 * Friendly copy for the `?error=<code>` better-auth appends when it redirects
 * an OAuth callback failure to the login page (the API's `onAPIError.errorURL`).
 * The common code is state_mismatch: the Google sign-in finished more than ten
 * minutes after it started, or the callback link was reused.
 */
export function describeAuthCallbackError(code: string | null): string {
  if (!code) return "";
  if (code === "state_mismatch" || code === "state_not_found") {
    return "That sign-in attempt expired or was already used. Please sign in again.";
  }
  if (code === "access_denied") {
    return "Sign-in was cancelled. Please try again.";
  }
  return "Something went wrong during sign-in. Please try again.";
}
