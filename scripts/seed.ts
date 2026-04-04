// ----- EXAMPLE: Seed script -----
// Creates test users for the chat example. Remove when building your own app.
// ----- END EXAMPLE -----

import { db } from "@app/db";
import { user, account } from "@app/db/schema";

async function seed() {
  const { hashPassword } = await import("better-auth/crypto");

  const users = [
    {
      id: "seed-alice-001",
      name: "Alice",
      email: "alice@test.com",
      username: "alice",
      displayUsername: "alice",
    },
    {
      id: "seed-bob-002",
      name: "Bob",
      email: "bob@test.com",
      username: "bob",
      displayUsername: "bob",
    },
  ];

  const password = "password123";
  const hashedPassword = await hashPassword(password);

  for (const u of users) {
    console.log(`Creating user: ${u.email}`);

    await db
      .insert(user)
      .values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        username: u.username,
        displayUsername: u.displayUsername,
        role: "user",
        banned: false,
        banReason: null,
        banExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(account)
      .values({
        id: `account-${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  console.log("\nSeed complete! You can now log in with:");
  console.log("  alice@test.com / password123");
  console.log("  bob@test.com / password123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
