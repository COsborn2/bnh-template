import { resolveMx } from "node:dns/promises";
import blocklistText from "../data/disposable-email-blocklist.conf" with { type: "text" };

let blocklist: Set<string> | null = null;

function ensureDisposableEmailBlocklist(): Set<string> {
  if (!blocklist) {
    blocklist = new Set(
      blocklistText
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
    );
  }

  return blocklist;
}

/** Optional warm-up call (index.ts) — parsing also happens lazily on first use. */
export async function initDisposableEmailBlocklist(): Promise<void> {
  ensureDisposableEmailBlocklist();
}

export function isDisposableEmail(email: string): boolean {
  const loadedBlocklist = ensureDisposableEmailBlocklist();
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return loadedBlocklist.has(domain);
}

export async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS timeout")), 5000)
      ),
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    const message = err instanceof Error ? err.message : "";
    // No records found — domain doesn't accept mail
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "ESERVFAIL") {
      return false;
    }
    // Timeout or other DNS failure — fail open, allow registration
    if (message === "DNS timeout") {
      return true;
    }
    // Unknown error — fail open
    return true;
  }
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateEmailDomain(email: string): Promise<EmailValidationResult> {
  // Check 1: Disposable email
  if (isDisposableEmail(email)) {
    return {
      valid: false,
      reason: "Please use a permanent email address. Disposable email addresses are not allowed.",
    };
  }

  // Check 2: MX records
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: "Invalid email address." };
  }

  const hasMx = await checkMxRecords(domain);
  if (!hasMx) {
    return {
      valid: false,
      reason: "We couldn't verify this email domain. Please check for typos.",
    };
  }

  return { valid: true };
}
