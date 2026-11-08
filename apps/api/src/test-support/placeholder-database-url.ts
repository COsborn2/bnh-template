/** The DATABASE_URL the test preload fills in when none is set, so pure unit
 *  tests can import modules that load the database package. Suites that need
 *  a real database refuse to run against it (__tests__/require-database.ts). */
export const PLACEHOLDER_DATABASE_URL = "postgres://test@localhost:5432/app_test";
