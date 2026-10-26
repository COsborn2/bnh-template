"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/session-user";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/page-loading";
import { Surface } from "@/components/ui/surface";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface DashboardClientProps {
  /** The signed-in user, fetched during SSR — first paint renders settled.
   *  Used only until `useSession` finishes its own load. */
  initialUser: SessionUser;
}

export function DashboardClient({ initialUser }: DashboardClientProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // If the session dies (or the user signs out) after the server render,
  // bounce to login — same behaviour as the old client-only page.
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [isPending, session, router]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/login");
  }

  // Signed out after SSR: show the (CSS-delayed) pulse while the redirect
  // above lands rather than a stale dashboard.
  if (!isPending && !session) {
    return <PageLoading />;
  }

  const user: SessionUser = session?.user ?? initialUser;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-text">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          {user.role === "admin" && (
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                Admin
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              Settings
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary" size="sm">
              Chat
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>

      <Surface className="p-8">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-text">
          Your profile
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Auth is working. Start building your app from here.
        </p>

        <div className="mt-6 space-y-4">
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          {user.username && (
            <InfoRow label="Username" value={`@${user.username}`} />
          )}
          <InfoRow
            label="Email verified"
            value={user.emailVerified ? "Yes" : "No"}
          />
        </div>
      </Surface>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-border pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <span className="min-w-0 truncate text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
