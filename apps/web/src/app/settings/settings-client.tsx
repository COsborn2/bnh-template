"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/session-user";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/page-loading";
import { ProfileSection } from "./_components/profile-section";
import { EmailSection } from "./_components/email-section";
import { PasswordSection } from "./_components/password-section";
import { ConnectedAccountsSection } from "./_components/connected-accounts-section";
import { DeleteAccountSection } from "./_components/delete-account-section";
import { useAccounts } from "./_components/use-accounts";

interface SettingsClientProps {
  /** The signed-in user, fetched during SSR — first paint renders settled.
   *  Sections fall back to this only until `useSession` finishes its own
   *  load, then follow the live session (profile edits, email changes). */
  initialUser: SessionUser;
}

export function SettingsClient({ initialUser }: SettingsClientProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  // One /list-accounts fetch shared by the password and connected-accounts
  // sections — both need to know whether a credential account exists.
  const accounts = useAccounts();

  // If the session dies (or the user signs out) after the server render,
  // bounce to login — same behaviour as the old client-only page.
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [isPending, session, router]);

  // Signed out after SSR: show the (CSS-delayed) pulse while the redirect
  // above lands rather than stale settings.
  if (!isPending && !session) {
    return <PageLoading />;
  }

  const user: SessionUser = session?.user ?? initialUser;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-text">Settings</h1>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <ProfileSection user={user} />
        <EmailSection user={user} />
        <PasswordSection
          hasPassword={accounts.hasPassword}
          onPasswordSet={accounts.refetch}
        />
        <ConnectedAccountsSection
          accounts={accounts.list}
          loadError={accounts.error || undefined}
          onAccountsChange={accounts.refetch}
        />
        <DeleteAccountSection
          email={user.email}
          hasPassword={accounts.hasPassword}
        />
      </div>
    </div>
  );
}
