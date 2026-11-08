/** One row of better-auth's GET /list-accounts, reduced to what the settings
 *  sections read. Kept out of the "use client" hook so the server page can
 *  shape the rows it prefetches too. */
export interface LinkedAccount {
  /** better-auth's own row id — what /unlink-account is keyed by. */
  id: string;
  /** "credential" for the password account, otherwise the OAuth provider id. */
  providerId: string;
  /** The user's id at the provider. */
  accountId: string;
}

export function toLinkedAccounts(
  rows: ReadonlyArray<{ id: string; providerId: string; accountId: string }>,
): LinkedAccount[] {
  return rows.map(({ id, providerId, accountId }) => ({ id, providerId, accountId }));
}
