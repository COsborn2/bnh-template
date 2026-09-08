import { useEffect, useState, useSyncExternalStore } from "react";

interface ErrorParamStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => string;
  consume: () => void;
}

/**
 * A one-shot external store over the page URL's `error` query param: the
 * mapped message is read once on the client and then frozen, so it survives
 * `consume()` stripping the param from the address bar.
 */
function createErrorParamStore(
  describe: (code: string | null) => string,
): ErrorParamStore {
  let snapshot: string | null = null;
  return {
    subscribe: () => () => {},
    getSnapshot: () => {
      if (snapshot === null) {
        snapshot = describe(
          new URLSearchParams(window.location.search).get("error"),
        );
      }
      return snapshot;
    },
    consume: () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("error") && !params.has("error_description")) return;
      params.delete("error");
      params.delete("error_description");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (query ? `?${query}` : ""),
      );
    },
  };
}

/**
 * Reads the `?error=<code>` better-auth appends when it redirects a failed
 * OAuth flow back to a page (the API's `onAPIError.errorURL`, or a
 * `linkSocial` call's `errorCallbackURL`), maps it through `describe`, and
 * strips `error` + `error_description` from the URL so a refresh does not
 * resurface a stale notice.
 *
 * Deliberately not `useSearchParams`: that hook would client-render everything
 * up to a Suspense boundary and drop the page from its statically prerendered
 * HTML. `useSyncExternalStore` reads the URL after hydration instead (the
 * server snapshot is "", so the prerendered markup never carries the notice)
 * without setting state inside an effect.
 */
export function useConsumedErrorParam(
  describe: (code: string | null) => string,
): string {
  const [store] = useState(() => createErrorParamStore(describe));
  const message = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => "",
  );

  useEffect(() => {
    if (message) store.consume();
  }, [message, store]);

  return message;
}
