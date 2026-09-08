import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const resolveMxMock = mock<
  (domain: string) => Promise<{ exchange: string; priority: number }[]>
>(() => Promise.resolve([{ exchange: "mail.example.com", priority: 10 }]));

mock.module("node:dns/promises", () => ({
  resolveMx: resolveMxMock,
}));

import {
  emailDomain,
  initDisposableEmailBlocklist,
  isDisposableEmail,
  checkMxRecords,
  validateEmailDomain,
} from "../email-validation";

beforeAll(async () => {
  await initDisposableEmailBlocklist();
});

beforeEach(() => {
  resolveMxMock.mockReset();
  resolveMxMock.mockImplementation(() =>
    Promise.resolve([{ exchange: "mail.example.com", priority: 10 }]),
  );
});

describe("emailDomain", () => {
  it("extracts the lowercased domain", () => {
    expect(emailDomain("alice@Corp.COM")).toBe("corp.com");
  });

  it("uses the last @ for quoted-local-part edge cases", () => {
    expect(emailDomain('"a@b"@corp.com')).toBe("corp.com");
  });

  it("returns null without an @", () => {
    expect(emailDomain("not-an-email")).toBeNull();
  });

  it("returns null for a trailing @", () => {
    expect(emailDomain("alice@")).toBeNull();
    expect(emailDomain("alice@   ")).toBeNull();
  });
});

describe("isDisposableEmail", () => {
  it("blocks known disposable domains", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
    expect(isDisposableEmail("test@guerrillamail.com")).toBe(true);
  });

  it("allows legitimate domains", () => {
    expect(isDisposableEmail("test@gmail.com")).toBe(false);
    expect(isDisposableEmail("test@outlook.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDisposableEmail("test@MAILINATOR.COM")).toBe(true);
  });
});

describe("checkMxRecords", () => {
  it("returns true for domains with MX records", async () => {
    const result = await checkMxRecords("gmail.com");
    expect(result).toBe(true);
  });

  it("returns false for non-existent domains", async () => {
    resolveMxMock.mockImplementationOnce(() => {
      const error = new Error("queryMx ENOTFOUND");
      (error as NodeJS.ErrnoException).code = "ENOTFOUND";
      return Promise.reject(error);
    });

    const result = await checkMxRecords(
      "thisdomain-definitely-does-not-exist-xyz123.com",
    );
    expect(result).toBe(false);
  });
});

describe("validateEmailDomain", () => {
  it("rejects disposable emails with specific error", async () => {
    const result = await validateEmailDomain("test@mailinator.com");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("permanent email");
  });

  it("accepts valid email domains", async () => {
    const result = await validateEmailDomain("test@gmail.com");
    expect(result.valid).toBe(true);
  });

  it("rejects domains with no MX records", async () => {
    resolveMxMock.mockImplementationOnce(() => {
      const error = new Error("queryMx ENODATA");
      (error as NodeJS.ErrnoException).code = "ENODATA";
      return Promise.reject(error);
    });

    const result = await validateEmailDomain(
      "test@thisdomain-definitely-does-not-exist-xyz123.com",
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("couldn't verify");
  });
});
