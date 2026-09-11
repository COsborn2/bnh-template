import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToString } from "react-dom/server";

/**
 * Server-render a client component that calls `useRouter()` (or renders
 * `next/link`) outside Next. The router methods are no-ops — enough for
 * components that only touch the router inside event handlers.
 *
 * Under this stub `usePathname()` and `useSearchParams()` both return null
 * (there is no PathnameContext / SearchParamsContext), so don't assert
 * pathname- or query-dependent branches; provide those contexts from
 * `next/dist/shared/lib/hooks-client-context.shared-runtime` if a test needs
 * them.
 */
export const routerStub = {
  push() {},
  replace() {},
  prefetch() {},
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
} as unknown as AppRouterInstance;

export function renderWithRouter(node: React.ReactNode): string {
  return renderToString(
    <AppRouterContext.Provider value={routerStub}>
      {node}
    </AppRouterContext.Provider>,
  );
}
