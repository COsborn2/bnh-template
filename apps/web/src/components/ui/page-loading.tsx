/**
 * Full-page loading state. A single centered pulse that stays invisible for
 * the first 250ms (see `.page-loading` in globals.css), so fast loads show
 * nothing at all and slow ones get a calm breathing dot instead of a
 * "Loading..." flash. No hooks, so it also server-renders from a route
 * `loading.tsx` should you add one.
 */
export function PageLoading() {
  return (
    <div className="relative min-h-[100svh]">
      <div className="page-loading">
        <div className="page-loading-pulse" />
      </div>
    </div>
  );
}
