// Test files import modules through "?real" query specifiers to bypass
// process-global bun mock.module registrations leaked from other test files
// (module mocks are keyed by resolved specifier, so the query misses them).
// TypeScript can't resolve query-suffixed paths; callers cast the import to
// `typeof import("<plain specifier>")` to recover the real types.
declare module "*?real";
