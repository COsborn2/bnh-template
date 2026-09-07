// ----- EXAMPLE: Seed script -----
// Creates test users for the chat example. Remove when building your own app.
//
// Runs as a Turbo task from the repo root: `bun run db:seed`.
// Living inside apps/api keeps runtime dependencies out of the workspace root
// and lets future seeds reuse real application code paths (auth, services).
// ----- END EXAMPLE -----

import { eq } from "drizzle-orm";
import { db, schema } from "@app/db";
import { auth } from "../lib/auth.js";

// Users are created through better-auth's own sign-up (auth.api.signUpEmail)
// rather than raw inserts, so the account row is exactly what the adapter
// expects and password hashing plus the production sign-up hooks run for
// real. Consequences worth knowing:
//   - the haveIBeenPwned plugin checks the password against the Pwned
//     Passwords API and hooks.before runs the disposable/MX email check, so
//     seeding needs outbound network (HTTPS + DNS) and the addresses must be
//     on a domain with MX records (email.com has them; test.com does not);
//   - captcha is an `onRequest` plugin and the origin check needs a request,
//     so neither applies to server-side auth.api.* calls — the headers below
//     only mirror what an HTTP sign-up would carry;
//   - sign-up sends a verification email; without RESEND_API_KEY the email
//     package just logs it. The row is marked verified right after.
// The first user is promoted to admin so the admin UI and impersonation can
// be tried locally. Re-seeding is a reset: an existing user with the same
// email is deleted first (the FK cascade clears sessions and accounts).

// One long, unique password: better-auth rejects breached ones.
const SEED_PASSWORD = "MyAppSeed!2026#Local7Hq";

const SEED_USERS = [
  { name: "Alice", email: "alice@email.com", username: "alice" },
  { name: "Bob", email: "bob@email.com", username: "bob" },
];

function createSeedAuthHeaders(): Headers {
  const origin =
    process.env.BETTER_AUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return new Headers({
    origin,
    referer: origin,
  });
}

async function deleteExistingUser(email: string): Promise<void> {
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });
  if (!existing) return;

  console.log(`Removing existing user: ${email}`);
  await db.delete(schema.user).where(eq(schema.user.id, existing.id));
}

async function createSeedUser(
  { name, email, username }: (typeof SEED_USERS)[number],
  role: "admin" | "user",
): Promise<void> {
  console.log(`Creating user: ${email} (${role})`);

  await auth.api.signUpEmail({
    body: { email, password: SEED_PASSWORD, name },
    headers: createSeedAuthHeaders(),
  });

  const [updated] = await db
    .update(schema.user)
    .set({
      emailVerified: true,
      role,
      username,
      displayUsername: username,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.email, email))
    .returning({ id: schema.user.id });

  if (!updated) {
    throw new Error(`Failed to create seed user ${email}`);
  }
}

async function seed() {
  for (const [index, seedUser] of SEED_USERS.entries()) {
    await deleteExistingUser(seedUser.email);
    await createSeedUser(seedUser, index === 0 ? "admin" : "user");
  }

  console.log("\nSeed complete! You can now log in with:");
  for (const [index, seedUser] of SEED_USERS.entries()) {
    const suffix = index === 0 ? " (admin)" : "";
    console.log(`  ${seedUser.email} / ${SEED_PASSWORD}${suffix}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
