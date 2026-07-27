// Set a dummy DATABASE_URL so @app/db can load without throwing when pure
// unit tests import modules that transitively pull it in. `??=` means a real
// DATABASE_URL (local dev, CI integration tests) always wins — this only
// fills the gap for tests that never touch the database.
process.env.DATABASE_URL ??= "postgres://test@localhost:5432/app_test";
