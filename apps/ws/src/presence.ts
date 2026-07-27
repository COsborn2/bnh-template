import type { PresenceUser } from "@app/shared";

/**
 * Presence is aggregated across WS instances through Redis: each instance
 * writes its local roster into the topic's presence hash (field = instance
 * id) and publishes a `presence-sync` message; every instance then merges
 * all rosters and pushes the combined list to its local subscribers. Events
 * already fan out through Redis this way — a per-instance presence list
 * would silently break with multiple replicas, because each client would
 * only ever see the users that happened to share its replica.
 */

export interface InstanceRoster {
  users: PresenceUser[];
  /** Epoch ms of the last write; refreshed by the instance heartbeat. */
  updatedAt: number;
}

/** Rosters older than this are treated as left behind by a dead instance. */
export const ROSTER_STALE_MS = 45_000;
/** How often an instance re-stamps its rosters and prunes stale peers. */
export const ROSTER_HEARTBEAT_MS = 15_000;

export function serializeRoster(users: PresenceUser[], now: number): string {
  const roster: InstanceRoster = { users, updatedAt: now };
  return JSON.stringify(roster);
}

/**
 * Merge every instance's roster (the raw Redis hash: instance id → JSON)
 * into one user list. Drops stale and malformed entries, dedupes users
 * connected through several instances, and sorts bytewise on (name, id) so
 * every instance broadcasts an identical list.
 */
export function mergeRosters(
  rostersByInstance: Record<string, string>,
  now: number
): PresenceUser[] {
  const byUserId = new Map<string, PresenceUser>();

  for (const raw of Object.values(rostersByInstance)) {
    let roster: InstanceRoster;
    try {
      roster = JSON.parse(raw) as InstanceRoster;
    } catch {
      continue;
    }
    if (
      typeof roster?.updatedAt !== "number" ||
      !Array.isArray(roster.users) ||
      now - roster.updatedAt > ROSTER_STALE_MS
    ) {
      continue;
    }
    for (const user of roster.users) {
      if (!user?.id) continue;
      if (!byUserId.has(user.id)) {
        byUserId.set(user.id, user);
      }
    }
  }

  return [...byUserId.values()].sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
