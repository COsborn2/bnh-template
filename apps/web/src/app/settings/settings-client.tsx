"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/session-user";
import { SettingsCard, SettingsCardHeader } from "@cosborn2/ui/settings";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { SettingsSectionId } from "./settings-user";
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
  section: SettingsSectionId;
}

export function SettingsClient({ initialUser, section }: SettingsClientProps) {
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
    <div className="flex flex-col gap-4 animate-fade-up">
      {section === "profile" && <><ProfileSection user={user} /><EmailSection user={user} /></>}
      {section === "password" && <PasswordSection hasPassword={accounts.hasPassword} onPasswordSet={accounts.refetch} />}
      {section === "connections" && <ConnectedAccountsSection accounts={accounts.list} loadError={accounts.error || undefined} onAccountsChange={accounts.refetch} />}
      {section === "appearance" && (
        <SettingsCard>
          <SettingsCardHeader title="Appearance" subtitle="Choose a light, dark, or system theme." />
          <ThemeToggle />
        </SettingsCard>
      )}
      {section === "delete" && <DeleteAccountSection email={user.email} hasPassword={accounts.hasPassword} />}
    </div>
  );
}
