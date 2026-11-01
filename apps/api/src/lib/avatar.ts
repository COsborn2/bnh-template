import { eq } from "drizzle-orm";
import { db } from "@app/db";
import { user as userTable } from "@app/db/schema";
import {
  parseAvatarOptions,
  randomAvatarOptions,
  renderAvatarSvg,
  type AvatarOptions,
} from "@app/shared";

// Avatars are rendered on the server from validated options and stored as an
// SVG string; clients only ever display it through an <img> data URI.

export interface ResolvedAvatar {
  options: AvatarOptions;
  svg: string;
  /** True when the stored row is out of date and should be written back. */
  changed: boolean;
}

/**
 * Reads a stored avatar the way every read path should: valid options
 * re-render as-is; missing or invalid options (a row created before avatars
 * existed, or a corrupt value) get a fresh random bot. `changed` is set
 * whenever the stored options or SVG differ from the result, so callers
 * persist it and the next read is a no-op.
 */
export function resolveStoredAvatar(stored: {
  avatarSvg: string;
  avatarOptions: unknown;
}): ResolvedAvatar {
  const parsed = parseAvatarOptions(stored.avatarOptions);
  const options = parsed ?? randomAvatarOptions();
  const svg = renderAvatarSvg(options);
  return { options, svg, changed: !parsed || stored.avatarSvg !== svg };
}

/** Saves already-validated options and returns the rendered SVG. */
export async function saveUserAvatar(userId: string, options: AvatarOptions): Promise<string> {
  const svg = renderAvatarSvg(options);
  await db
    .update(userTable)
    .set({ avatarOptions: options, avatarSvg: svg })
    .where(eq(userTable.id, userId));
  return svg;
}

/**
 * The user's avatar, repaired and persisted if it was missing or stale.
 * Returns null when the user doesn't exist.
 */
export async function getUserAvatar(userId: string): Promise<{ options: AvatarOptions; svg: string } | null> {
  const [row] = await db
    .select({ avatarSvg: userTable.avatarSvg, avatarOptions: userTable.avatarOptions })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row) return null;

  const avatar = resolveStoredAvatar(row);
  if (avatar.changed) await saveUserAvatar(userId, avatar.options);
  return { options: avatar.options, svg: avatar.svg };
}

/** Gives a brand-new account its first random bot. */
export async function assignRandomAvatar(userId: string): Promise<void> {
  await saveUserAvatar(userId, randomAvatarOptions());
}
