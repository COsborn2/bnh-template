// Test suite for the migrate app so `turbo test` covers every workspace.
// It sanity-checks that the Drizzle journal and the migration SQL files on
// disk agree (catching half-committed migration folders), and that already
// published migrations are never rewritten in place.

import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const migrationsDir = join(import.meta.dir, "migrations");

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

async function readJournal(): Promise<Journal> {
  return (await Bun.file(
    join(migrationsDir, "meta", "_journal.json"),
  ).json()) as Journal;
}

describe("migrations folder", () => {
  test("every journal entry has a matching SQL file", async () => {
    const journal = await readJournal();

    expect(journal.entries.length).toBeGreaterThan(0);

    const files = await readdir(migrationsDir);
    for (const entry of journal.entries) {
      expect(files).toContain(`${entry.tag}.sql`);
    }
  });

  test("every SQL file is recorded in the journal", async () => {
    const journal = await readJournal();

    const tags = new Set(journal.entries.map((entry) => entry.tag));
    const files = await readdir(migrationsDir);
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      expect(tags).toContain(file.replace(/\.sql$/, ""));
    }
  });

  test("journal entries are sequential with increasing timestamps", async () => {
    const journal = await readJournal();

    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      if (index > 0) {
        // drizzle's migrator replays every entry whose `when` exceeds the
        // last applied migration's created_at, so timestamps must be
        // strictly increasing for new migrations to apply in order.
        expect(entry.when).toBeGreaterThan(journal.entries[index - 1]!.when);
      }
    });
  });

  test("published migrations are never rewritten in place", async () => {
    // These entries have shipped: deployed databases record their `when`
    // values in drizzle.__drizzle_migrations. Rewriting a published SQL
    // file (and bumping `when`) makes drizzle re-run it against existing
    // databases, which fails on the first duplicate DDL statement. Schema
    // changes must land as NEW migrations appended to the journal.
    const published: Array<[number, string, number]> = [
      [0, "0000_good_shen", 1774171875841],
    ];

    const journal = await readJournal();
    for (const [idx, tag, when] of published) {
      const entry = journal.entries[idx];
      expect(entry).toBeDefined();
      expect(entry!.tag).toBe(tag);
      expect(entry!.when).toBe(when);
    }
  });
});
