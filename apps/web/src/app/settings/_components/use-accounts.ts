"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** One row of better-auth's GET /list-accounts. */
export interface LinkedAccount {
  /** better-auth's own row id — what /unlink-account is keyed by. */
  id: string;
  /** "credential" for the password account, otherwise the OAuth provider id. */
  providerId: string;
  /** The user's id at the provider. */
  accountId: string;
}

export interface AccountsState {
  /** Every account, credential rows included; null until the fetch settles. */
  list: LinkedAccount[] | null;
  /** Whether a password is set — a "credential" row exists only when one is.
   *  null while unknown. */
  hasPassword: boolean | null;
  /** Set when the fetch failed (the list stays null). */
  error: string;
  refetch: () => Promise<void>;
}

const LOAD_ERROR = "Couldn't load your sign-in methods.";

type FetchResult = { list: LinkedAccount[] } | { error: string };

async function fetchAccounts(): Promise<FetchResult> {
  try {
    const { data, error } = await authClient.listAccounts();
    if (error) return { error: error.message || LOAD_ERROR };
    return {
      list: data.map(({ id, providerId, accountId }) => ({
        id,
        providerId,
        accountId,
      })),
    };
  } catch {
    return { error: LOAD_ERROR };
  }
}

/**
 * The viewer's sign-in methods. Fetched once by the settings shell and shared
 * by the password and connected-accounts sections, which both need to know
 * whether a credential account exists.
 */
export function useAccounts(): AccountsState {
  const [list, setList] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState("");

  const apply = useCallback((result: FetchResult) => {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setList(result.list);
    setError("");
  }, []);

  const refetch = useCallback(() => fetchAccounts().then(apply), [apply]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    list,
    hasPassword: list ? list.some((a) => a.providerId === "credential") : null,
    error,
    refetch,
  };
}
