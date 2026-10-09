import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, LockKeyhole, Monitor, Trash2, UserRound } from "lucide-react";
import { SettingsLayout, SettingsNavigation, SettingsPageHeader, type RailSection, type SettingsNavigationItem } from "@cosborn2/ui/settings";
import { HeaderShell } from "@cosborn2/ui/header-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { serverApiOrNull } from "@/lib/server-api";
import { SettingsClient } from "./settings-client";
import { settingsSection } from "./settings-user";
import type { SessionUser } from "@/lib/session-user";
import "@cosborn2/ui/settings.css";
import "@cosborn2/ui/header-shell.css";

export const metadata: Metadata = { title: "Account settings" };

const sections: RailSection<SettingsNavigationItem>[] = [
  { group: "Account", items: [
    { id: "profile", label: "Profile", href: "/settings", icon: <UserRound size={13} /> },
    { id: "connections", label: "Connected accounts", href: "/settings?section=connections", icon: <Link2 size={13} /> },
    { id: "password", label: "Password", href: "/settings?section=password", icon: <LockKeyhole size={13} /> },
  ] },
  { group: "Preferences", items: [
    { id: "appearance", label: "Appearance", href: "/settings?section=appearance", icon: <Monitor size={13} /> },
  ] },
  { group: "Danger zone", items: [
    { id: "delete", label: "Delete account", href: "/settings?section=delete", icon: <Trash2 size={13} /> },
  ] },
];

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const [result, query] = await Promise.all([
    serverApiOrNull<{ user: SessionUser } | null>("/auth/get-session"),
    searchParams,
  ]);
  if (!result?.user) redirect("/auth/login");
  const section = settingsSection(query.section);

  return (
    <SettingsLayout
      header={
        <HeaderShell
          minWidth="min(520px, calc(100vw - 28px))"
          left={
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-[13px] text-text-muted [scrollbar-width:none]">
              <Link href="/dashboard" className="whitespace-nowrap">Home</Link>
              <span aria-hidden="true" className="opacity-35">/</span>
              <span className="whitespace-nowrap font-medium text-text">Account settings</span>
            </nav>
          }
          right={<ThemeToggle />}
        />
      }
      navigation={<SettingsNavigation sections={sections} active={section} />}
    >
      <SettingsPageHeader eyebrow="Account" title="Settings" description="Manage your account and preferences." animate />
      <SettingsClient key={section} initialUser={result.user} section={section} />
    </SettingsLayout>
  );
}
