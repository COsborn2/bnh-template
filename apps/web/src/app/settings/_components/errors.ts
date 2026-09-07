const appName = process.env.NEXT_PUBLIC_APP_NAME || "MyApp";

/** Maps Better Auth's delete-user error shape to friendly copy. */
export function describeDeleteError(error: {
  code?: string;
  message?: string;
  status?: number;
}): string {
  if (error.status === 429) {
    return "Too many attempts. Please wait a little while and try again.";
  }
  switch (error.code) {
    case "INVALID_PASSWORD":
      return "Incorrect password. Please try again.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "No password is set on this account. Try signing out and back in, then try again.";
    default:
      return (
        error.message || "Couldn't start account deletion. Please try again."
      );
  }
}

/**
 * Copy for the `?error=<code>` better-auth appends when a link-social
 * callback fails and redirects back here (handleConnect passes
 * errorCallbackURL "/settings"). Codes come from better-auth's OAuth
 * callback route.
 */
export function describeLinkError(code: string | null): string {
  if (!code) return "";
  if (code === "email_does_not_match") {
    return `That Google account uses a different email than your ${appName} account, so it can't be linked.`;
  }
  if (code === "account_already_linked_to_different_user") {
    return `That Google account is already linked to another ${appName} account.`;
  }
  if (code === "access_denied") {
    return "Connecting was cancelled.";
  }
  return "Connecting your Google account failed. Please try again.";
}
