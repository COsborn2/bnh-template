"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/session-user";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/page-loading";
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-text">Dashboard</h1>
        <div className="flex items-center gap-3">
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

      <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
        <h2 className="font-display text-xl font-semibold text-text">
          Your profile
        </h2>
        <p className="mt-1 text-sm text-text-muted">
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
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text">{value}</span>
    </div>
  );
}
