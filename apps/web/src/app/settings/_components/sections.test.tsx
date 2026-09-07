import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ConnectedAccountsSection } from "./connected-accounts-section";
import { DeleteAccountSection } from "./delete-account-section";
import { EmailSection } from "./email-section";
import { PasswordSection } from "./password-section";

/** renderToString, minus React's SSR comment markers so toContain works. */
const rts = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, "");

const noop = () => {};
const credential = { id: "acc_1", providerId: "credential", accountId: "u1" };
const google = { id: "acc_2", providerId: "google", accountId: "g1" };

describe("EmailSection", () => {
  test("shows the address with a Verified pill when verified", () => {
    const html = rts(
      <EmailSection user={{ email: "me@example.com", emailVerified: true }} />,
    );
    expect(html).toContain("me@example.com");
    expect(html).toContain("Verified");
    expect(html).toContain("Change email");
  });

  test("omits the pill when unverified", () => {
    const html = rts(
      <EmailSection user={{ email: "me@example.com", emailVerified: false }} />,
    );
    expect(html).not.toContain("Verified");
  });
});

describe("PasswordSection", () => {
  test("keeps the change form while accounts are unknown", () => {
    const html = rts(
      <PasswordSection hasPassword={null} onPasswordSet={noop} />,
    );
    expect(html).toContain("Change password");
    expect(html).toContain("Current password");
  });

  test("offers to set a password for OAuth-only accounts", () => {
    const html = rts(
      <PasswordSection hasPassword={false} onPasswordSet={noop} />,
    );
    expect(html).toContain("Set a password");
    expect(html).not.toContain("Current password");
  });
});

describe("ConnectedAccountsSection", () => {
  test("renders a skeleton, never a wrong row, while loading", () => {
    const html = rts(
      <ConnectedAccountsSection accounts={null} onAccountsChange={noop} />,
    );
    expect(html).toContain("animate-pulse-soft");
    expect(html).not.toContain(">Connect<");
  });

  test("shows the load error instead of the skeleton", () => {
    const html = rts(
      <ConnectedAccountsSection
        accounts={null}
        loadError="Sign-in methods are unavailable"
        onAccountsChange={noop}
      />,
    );
    expect(html).toContain("Sign-in methods are unavailable");
    expect(html).not.toContain("animate-pulse-soft");
  });

  test("offers Connect when Google is not linked", () => {
    const html = rts(
      <ConnectedAccountsSection
        accounts={[credential]}
        onAccountsChange={noop}
      />,
    );
    expect(html).toContain(">Connect<");
    expect(html).not.toContain("Disconnect");
    expect(html).not.toContain("Connected</span>");
  });

  test("allows Disconnect when a password exists", () => {
    const html = rts(
      <ConnectedAccountsSection
        accounts={[credential, google]}
        onAccountsChange={noop}
      />,
    );
    expect(html).toContain("Connected</span>");
    expect(html).toMatch(/<button[^>]*>Disconnect<\/button>/);
    expect(html).not.toMatch(
      /<button[^>]*disabled=""[^>]*>Disconnect<\/button>/,
    );
    expect(html).not.toContain("Set a password before disconnecting");
  });

  test("blocks disconnecting the only sign-in method with a hint", () => {
    const html = rts(
      <ConnectedAccountsSection accounts={[google]} onAccountsChange={noop} />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Disconnect<\/button>/);
    expect(html).toContain("Set a password before disconnecting");
  });
});

describe("DeleteAccountSection", () => {
  test("explains the emailed confirmation before anything is deleted", () => {
    const html = rts(<DeleteAccountSection email="me@example.com" />);
    expect(html).toContain("Delete account");
    expect(html).toContain("confirmation link");
    expect(html).not.toContain("Check your email");
  });
});
