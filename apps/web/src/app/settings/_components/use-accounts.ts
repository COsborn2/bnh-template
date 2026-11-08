"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { toLinkedAccounts, type LinkedAccount } from "./linked-accounts";

export type { LinkedAccount };

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
    return { list: toLinkedAccounts(data) };
  } catch {
    return { error: LOAD_ERROR };
  }
}

/**
 * The viewer's sign-in methods, shared by the password, connected-accounts
 * and delete sections, which all need to know whether a credential account
 * exists. The server page prefetches them for those sections (`initial`);
 * the browser only fetches when that prefetch failed, and not at all for
 * sections that don't need them (`needed`).
 */
export function useAccounts(
  initial: LinkedAccount[] | null,
  needed: boolean,
): AccountsState {
  const [list, setList] = useState<LinkedAccount[] | null>(initial);
  const hasInitial = initial !== null;
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
    if (needed && !hasInitial) void refetch();
  }, [needed, hasInitial, refetch]);

  return {
    list,
    hasPassword: list ? list.some((a) => a.providerId === "credential") : null,
    error,
    refetch,
  };
}
