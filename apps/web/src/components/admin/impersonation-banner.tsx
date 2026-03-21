"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Fetch session directly from API (bypasses cookie cache which may not include impersonatedBy)
    authClient.getSession({
      query: { disableCookieCache: true },
    }).then((res) => {
      if (!res.data) return;
      const session = res.data.session as Record<string, unknown>;
      if (session.impersonatedBy) {
        setImpersonating(true);
        setUserName(res.data.user.name);
      }
    }).catch(() => {});
  }, []);

  if (!impersonating) return null;

  const handleStopImpersonating = async () => {
    await authClient.admin.stopImpersonating();
    // Hard reload to restore the admin's own session
    window.location.href = "/admin/users";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-accent-amber px-4 py-2">
      <span className="text-sm font-medium text-black">
        You are impersonating {userName}
      </span>
      <button
        type="button"
        onClick={handleStopImpersonating}
        className="rounded bg-black/20 px-3 py-1 text-sm font-medium text-black hover:bg-black/30"
      >
        Stop impersonating
      </button>
    </div>
  );
}
