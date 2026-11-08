import { authClient } from "@/lib/auth-client";

/**
 * Stores that cache data belonging to the signed-in viewer (the avatar
 * store, and any you add) are module singletons, and every account switch is
 * a soft navigation: signing out from any page, the next person signing in
 * on the same tab, starting or stopping an impersonation. Nothing tears those
 * stores down, so each registers a `reset` here, and this module resets them
 * all when the session's user changes away from a signed-in account. One
 * viewer's data can then never render for the next.
 */

const resets = new Set<() => void>();
let viewerId: string | null = null;

/** The account the viewer-scoped stores hold data for; null while signed out
 *  or before the session settles. */
export function getViewerId(): string | null {
  return viewerId;
}

export function registerViewerScopedStore(reset: () => void): void {
  resets.add(reset);
}

export function setViewer(nextViewerId: string | null): void {
  const previous = viewerId;
  viewerId = nextViewerId;
  // A tab starts anonymous, so null → someone is just the session resolving.
  // Only a change away from a signed-in account can leave data behind.
  if (previous === null || previous === nextViewerId) return;
  for (const reset of resets) reset();
}

interface SessionAtomValue {
  data: { user: { id: string } } | null;
  isPending: boolean;
}

// Follow better-auth's session store itself rather than a component effect:
// its subscribers run as soon as the session changes, before React renders
// anything for the new account, so no component reads the previous one's
// cache first. The root layout's useSession() already keeps this store live
// on every page, so subscribing costs no extra request.
if (typeof window !== "undefined") {
  authClient.$store.atoms.session?.subscribe((value: SessionAtomValue) => {
    if (value.isPending) return;
    setViewer(value.data?.user.id ?? null);
  });
}
