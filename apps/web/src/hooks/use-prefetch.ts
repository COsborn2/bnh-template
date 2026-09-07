"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Prefetch a route on user intent (hover/focus), once per mount.
 *
 * Next.js only auto-prefetches <Link> targets; navigations that go through
 * `router.push` in an onClick (cards, table rows) get nothing, so the
 * heaviest route chunks download only after the click. Wire the returned
 * callback to pointerenter/focus of such elements.
 *
 * Intent-scoped on purpose: prefetching every card on mount would fan out one
 * RSC request per card (dynamic routes render server-side up to loading.tsx).
 */
export function usePrefetchOnIntent(href: string | undefined): () => void {
  const router = useRouter();
  // Once per href (not per mount): router.prefetch caches, this just avoids
  // re-entering it on every hover — and a mounted card whose href prop
  // changes still prefetches the new target.
  const prefetched = useRef<string | null>(null);
  return useCallback(() => {
    if (!href || prefetched.current === href) return;
    prefetched.current = href;
    router.prefetch(href);
  }, [router, href]);
}
