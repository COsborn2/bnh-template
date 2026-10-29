/**
 * Stand-ins for the third-party services the API calls, installed for every
 * API test file by src/test-preload.ts so the suites never touch the network:
 *
 *  - DNS MX lookups (services/email-validation.ts): every domain has a mail
 *    server except those under the reserved `.invalid` TLD (RFC 2606), which
 *    answer ENOTFOUND like a real domain without one.
 *  - Have I Been Pwned's range API (better-auth's haveIBeenPwned plugin and
 *    routes/account.ts): answers in the real `SUFFIX:COUNT` format, reporting
 *    only BREACHED_PASSWORDS as compromised, so the plugin's hashing and
 *    parsing still run for real.
 *
 * Any other request to a non-local host throws, so a new integration fails
 * loudly instead of depending on outbound network. Fake it here.
 */

import { mock } from "bun:test";
import { createHash } from "node:crypto";
import * as realDns from "node:dns/promises";

/** Passwords the fake Have I Been Pwned range API reports as breached. */
export const BREACHED_PASSWORDS = ["password", "password123", "123456"];

type MxRecord = { exchange: string; priority: number };

/** The fake resolver's default answer; tests may override `resolveMxMock`. */
export function defaultResolveMx(domain: string): Promise<MxRecord[]> {
  if (domain === "invalid" || domain.endsWith(".invalid")) {
    const error: NodeJS.ErrnoException = new Error(`queryMx ENOTFOUND ${domain}`);
    error.code = "ENOTFOUND";
    return Promise.reject(error);
  }
  return Promise.resolve([{ exchange: `mx.${domain}`, priority: 10 }]);
}

export const resolveMxMock = mock(defaultResolveMx);

const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function pwnedRange(prefix: string): string {
  return BREACHED_PASSWORDS.map((password) =>
    createHash("sha1").update(password).digest("hex").toUpperCase(),
  )
    .filter((hash) => hash.startsWith(prefix.toUpperCase()))
    .map((hash) => `${hash.slice(5)}:1000`)
    .join("\r\n");
}

export function installNetworkFakes(): void {
  mock.module("node:dns/promises", () => ({ ...realDns, resolveMx: resolveMxMock }));

  const realFetch = globalThis.fetch;
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (LOCAL_HOSTNAMES.has(url.hostname)) return realFetch(input, init);
    if (url.href.startsWith(PWNED_RANGE_URL)) {
      const prefix = url.pathname.split("/").pop() ?? "";
      return new Response(pwnedRange(prefix), { headers: { "content-type": "text/plain" } });
    }
    // Libraries often swallow fetch errors (better-auth turns them into a 500),
    // so say what happened before throwing.
    const message = `Tests must not reach the network (${url.origin}); fake it in src/__tests__/network-fakes.ts`;
    console.error(message);
    throw new Error(message);
  };
  globalThis.fetch = Object.assign(fakeFetch, { preconnect: realFetch.preconnect });
}
