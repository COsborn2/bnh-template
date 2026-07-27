import { describe, test, expect } from "bun:test";
import { mergeRosters, serializeRoster, ROSTER_STALE_MS } from "./presence";
import type { PresenceUser } from "@app/shared";

const NOW = 1_700_000_000_000;

function user(id: string, name = `user-${id}`): PresenceUser {
  return { id, name, isGuest: false };
}

describe("mergeRosters", () => {
  test("combines users from multiple instances", () => {
    const merged = mergeRosters(
      {
        "instance-a": serializeRoster([user("1"), user("2")], NOW),
        "instance-b": serializeRoster([user("3")], NOW),
      },
      NOW
    );
    expect(merged.map((u) => u.id).sort()).toEqual(["1", "2", "3"]);
  });

  test("dedupes a user connected through several instances", () => {
    const merged = mergeRosters(
      {
        "instance-a": serializeRoster([user("1")], NOW),
        "instance-b": serializeRoster([user("1"), user("2")], NOW),
      },
      NOW
    );
    expect(merged.map((u) => u.id).sort()).toEqual(["1", "2"]);
  });

  test("drops rosters from instances that stopped heartbeating", () => {
    const merged = mergeRosters(
      {
        alive: serializeRoster([user("1")], NOW - ROSTER_STALE_MS + 1000),
        dead: serializeRoster([user("2")], NOW - ROSTER_STALE_MS - 1000),
      },
      NOW
    );
    expect(merged.map((u) => u.id)).toEqual(["1"]);
  });

  test("ignores malformed roster entries", () => {
    const merged = mergeRosters(
      {
        good: serializeRoster([user("1")], NOW),
        garbage: "not json{",
        wrongShape: JSON.stringify({ hello: "world" }),
        noTimestamp: JSON.stringify({ users: [user("9")] }),
      },
      NOW
    );
    expect(merged.map((u) => u.id)).toEqual(["1"]);
  });

  test("returns a deterministic order regardless of instance iteration order", () => {
    const a = mergeRosters(
      {
        "instance-a": serializeRoster([user("2", "zoe"), user("1", "amy")], NOW),
        "instance-b": serializeRoster([user("3", "mia")], NOW),
      },
      NOW
    );
    const b = mergeRosters(
      {
        "instance-b": serializeRoster([user("3", "mia")], NOW),
        "instance-a": serializeRoster([user("1", "amy"), user("2", "zoe")], NOW),
      },
      NOW
    );
    expect(a).toEqual(b);
    expect(a.map((u) => u.name)).toEqual(["amy", "mia", "zoe"]);
  });

  test("skips users without an id", () => {
    const merged = mergeRosters(
      {
        a: JSON.stringify({
          users: [{ name: "ghost", isGuest: false }, user("1")],
          updatedAt: NOW,
        }),
      },
      NOW
    );
    expect(merged.map((u) => u.id)).toEqual(["1"]);
  });

  test("returns empty list for no rosters", () => {
    expect(mergeRosters({}, NOW)).toEqual([]);
  });
});
