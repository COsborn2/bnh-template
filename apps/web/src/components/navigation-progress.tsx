"use client";

import {
  createContext,
  useCallback,
  useContext,
  useOptimistic,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * The signed-in pages render on the server and have no loading.tsx, so a
 * navigation keeps the current page on screen until the next one is ready
 * (a loading.tsx fallback would blank the page for React's 300ms minimum,
 * however fast the server answers). These helpers make that wait visible: a
 * bar along the top edge, hidden for the first 150ms so quick navigations
 * show nothing, and the href being opened, so the clicked link can show it.
 *
 * Both last exactly as long as the navigation's transition: they clear when
 * the next page commits, or when the navigation fails or is superseded.
 */
type Navigate = (href: string) => void;

const NavigateContext = createContext<Navigate | null>(null);
const PendingHrefContext = createContext<string | null>(null);

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useOptimistic<string | null>(null);
  const navigate = useCallback<Navigate>(
    (href) =>
      startTransition(() => {
        setPendingHref(href);
        router.push(href);
      }),
    [router, setPendingHref],
  );
  return (
    <NavigateContext.Provider value={navigate}>
      <PendingHrefContext.Provider value={pendingHref}>
        {children}
        <div
          className="app-nav-progress"
          data-active={pendingHref !== null || undefined}
          aria-hidden
        />
      </PendingHrefContext.Provider>
    </NavigateContext.Provider>
  );
}

/** Client-side navigation that shows its progress (see above), for code
 *  that navigates from an event handler instead of a link. Outside the
 *  provider (component tests) it falls back to a full page load. */
export function useNavigate(): Navigate {
  return useContext(NavigateContext) ?? fullPageLoad;
}

function fullPageLoad(href: string) {
  window.location.assign(href);
}

/** The href a navigation is opening, until its page is up. */
export function usePendingHref(): string | null {
  return useContext(PendingHrefContext);
}

/**
 * A `Link` whose navigation shows the progress bar and marks the link
 * `data-pending` / `aria-busy` while its page renders. Modifier and middle
 * clicks still open a new tab as usual (Next skips onNavigate for those).
 */
export function PendingLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  const navigate = useContext(NavigateContext);
  const pending = usePendingHref() === href;
  return (
    <Link
      {...props}
      href={href}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      onNavigate={
        navigate
          ? (e) => {
              e.preventDefault();
              navigate(href);
            }
          : undefined
      }
    />
  );
}
