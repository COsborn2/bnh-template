"use client";

import { useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/google-sign-in-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsumedErrorParam } from "@/hooks/use-consumed-error-param";
import { describeLinkError, describeUnlinkError } from "./errors";
import { StatusPill } from "./status-pill";
import type { LinkedAccount } from "./use-accounts";

interface ConnectedAccountsSectionProps {
  /** Every account from /list-accounts, credential rows included — they
   *  decide whether the last social login may be disconnected. null while
   *  the list is still loading. */
  accounts: LinkedAccount[] | null;
  /** Set when the accounts fetch failed — shown instead of a possibly-wrong
   *  "not connected" row. */
  loadError?: string;
  /** Refetch after a disconnect changes the list. */
  onAccountsChange: () => Promise<void> | void;
}

/**
 * Google link/unlink. Like the sign-in buttons, this assumes the API has
 * Google configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); without it
 * better-auth answers "Provider not found", which lands in the error slot.
 */
export function ConnectedAccountsSection({
  accounts,
  loadError,
  onAccountsChange,
}: ConnectedAccountsSectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // A failed link-social callback lands back on /settings?error=<code>
  // (errorCallbackURL below). Surface it in this card's error slot.
  const linkError = useConsumedErrorParam(describeLinkError);

  if (!accounts) {
    return (
      <Card>
        {loadError ? (
          <p className="mt-6 text-sm text-accent-rose">{loadError}</p>
        ) : (
          <div className="mt-6 flex items-center gap-4">
            <Skeleton className="h-9 w-9" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        )}
      </Card>
    );
  }

  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const socialAccounts = accounts.filter((a) => a.providerId !== "credential");
  const googleAccount = socialAccounts.find((a) => a.providerId === "google");
  const otherAccounts = socialAccounts.filter((a) => a.providerId !== "google");
  // The server refuses to unlink the last account (FAILED_TO_UNLINK_LAST_ACCOUNT);
  // mirror it so the button explains itself instead of failing.
  const hasOtherAuth = hasPassword || socialAccounts.length > 1;

  async function handleConnect() {
    setError("");
    setIsConnecting(true);
    try {
      const { error: linkError } = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/settings",
        // Without this, a failed link callback falls back to better-auth's
        // global error page (onAPIError.errorURL, or its built-in /error) —
        // telling a signed-in user their sign-in failed. Land back here.
        errorCallbackURL: "/settings",
      });
      // On success the client follows the returned URL to Google itself.
      if (linkError) {
        setError(linkError.message || "Failed to connect account");
        setIsConnecting(false);
      }
    } catch {
      setError("Failed to connect account");
      setIsConnecting(false);
    }
  }

  async function handleDisconnect(account: LinkedAccount) {
    setError("");
    setDisconnectingId(account.id);
    try {
      // /unlink-account is keyed by better-auth's account row id.
      const { error: unlinkError } = await authClient.unlinkAccount({
        accountId: account.id,
      });
      if (unlinkError) {
        setError(describeUnlinkError(unlinkError));
        return;
      }
      await onAccountsChange();
    } catch {
      setError("Failed to disconnect account");
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <Card>
      <div className="mt-6">
        <AccountRow
          logo={<GoogleLogo className="h-4 w-4" />}
          name="Google"
          connected={Boolean(googleAccount)}
          description={
            googleAccount
              ? "Sign in with Google. Access to email & profile."
              : "Sign in faster with your Google account."
          }
          hint={
            googleAccount && !hasOtherAuth
              ? "Set a password before disconnecting your only sign-in method."
              : undefined
          }
          action={
            googleAccount ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleDisconnect(googleAccount)}
                disabled={!hasOtherAuth || disconnectingId === googleAccount.id}
              >
                {disconnectingId === googleAccount.id
                  ? "Disconnecting..."
                  : "Disconnect"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? "Redirecting..." : "Connect"}
              </Button>
            )
          }
        />
        {otherAccounts.map((account) => (
          <AccountRow
            key={account.id}
            logo={
              <span className="text-sm font-semibold uppercase text-text-muted">
                {account.providerId.charAt(0)}
              </span>
            }
            name={account.providerId}
            connected
            description={`Sign in with ${account.providerId}.`}
            hint={
              hasOtherAuth
                ? undefined
                : "Set a password before disconnecting your only sign-in method."
            }
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleDisconnect(account)}
                disabled={!hasOtherAuth || disconnectingId === account.id}
              >
                {disconnectingId === account.id
                  ? "Disconnecting..."
                  : "Disconnect"}
              </Button>
            }
          />
        ))}
      </div>

      {(error || linkError) && (
        <p className="mt-4 text-sm text-accent-rose">{error || linkError}</p>
      )}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
      <h2 className="font-display text-xl font-semibold text-text">
        Connected accounts
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Other ways to sign in to your account.
      </p>
      {children}
    </div>
  );
}

function AccountRow({
  logo,
  name,
  connected,
  description,
  hint,
  action,
}: {
  logo: ReactNode;
  name: string;
  connected: boolean;
  description: string;
  hint?: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-bg-input">
        {logo}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize text-text">
            {name}
          </span>
          {connected && <StatusPill>Connected</StatusPill>}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        {hint && <p className="mt-1 text-xs text-text-faint">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
