import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverApiOrNull } from "@/lib/server-api";
import type { SessionUser } from "@/lib/session-user";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

/**
 * Fully SSR: the session is fetched with the request's cookies and access is
 * gated here, so the client renders settled content on first paint — no
 * full-screen loading flash. better-auth answers GET /get-session with a 200
 * and a `null` body for anonymous viewers (serverApiOrNull also maps a 401
 * to null), so a null result simply means "not signed in".
 */
export default async function SettingsPage() {
  const session = await serverApiOrNull<{ user: SessionUser } | null>(
    "/auth/get-session",
  );

  if (!session?.user) {
    redirect("/auth/login");
  }

  return <SettingsClient initialUser={session.user} />;
}
