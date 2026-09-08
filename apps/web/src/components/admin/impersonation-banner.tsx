"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

export function ImpersonationBanner() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAuthenticated = !!session;
  const userId = session?.user.id;
  const [impersonating, setImpersonating] = useState(false);
  const [userName, setUserName] = useState("");

  // This banner is mounted in the root layout, so starting/stopping
  // impersonation no longer remounts it (both are soft navigations). Re-run
  // the check whenever the viewer identity changes — the admin client plugin
  // refetches useSession() after impersonate/stop, so `user.id` flipping is
  // the signal that the session behind the cookie is a different one.
  // `disableCookieCache` keeps this off the cookie cache, which can still hold
  // the old session at this point. Impersonation only exists for signed-in
  // sessions, so anonymous page loads skip the probe entirely; the render gate
  // below hides the banner instantly on sign-out.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    authClient
      .getSession({
        query: { disableCookieCache: true },
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.session.impersonatedBy) {
          setImpersonating(true);
          setUserName(res.data.user.name);
        } else {
          setImpersonating(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  const visible = impersonating && isAuthenticated;
  if (!visible) return null;

  const handleStopImpersonating = async () => {
    await authClient.admin.stopImpersonating();
    // Soft navigation, so nothing resets itself the way a document load did:
    // useSession() refetches via the plugin's session signal (which re-runs the
    // probe above and hides the banner), and router.refresh() re-renders server
    // components and the client router cache under the admin's session again.
    router.push("/admin/users");
    router.refresh();
  };

  return (
    <ImpersonationBannerView
      userName={userName}
      onStop={handleStopImpersonating}
    />
  );
}

/** Presentational half, kept free of router/session hooks so it renders under
 *  renderToString. Sits in normal flow (sticky) so page content is pushed down
 *  instead of covered. */
export function ImpersonationBannerView({
  userName,
  onStop,
}: {
  userName: string;
  onStop: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-accent-amber/40 bg-accent-amber px-4 py-2">
      {/* min-w-0 + break-words: an unbroken user name must wrap — in flow it
          would otherwise widen the document and add a page-wide horizontal
          scrollbar. */}
      <span className="min-w-0 break-words text-sm font-medium text-black">
        You are impersonating {userName}
      </span>
      <button
        type="button"
        onClick={onStop}
        className="shrink-0 rounded bg-black/20 px-3 py-1 text-sm font-medium text-black hover:bg-black/30"
      >
        Stop impersonating
      </button>
    </div>
  );
}
