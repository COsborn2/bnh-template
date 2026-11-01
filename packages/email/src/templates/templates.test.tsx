import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { emailColors } from "./layout.js";
import { VerificationEmail } from "./verification.js";
import { PasswordResetEmail } from "./password-reset.js";
import { PasswordChangedEmail } from "./password-changed.js";
import { EmailChangeApprovalEmail } from "./email-change-approval.js";
import { EmailChangedEmail } from "./email-changed.js";
import { DeleteAccountVerificationEmail } from "./delete-account-verification.js";

const url = "https://example.com/auth/callback?token=example-token";
const newEmail = "newemail@example.com";

/** Every template, with the user-visible text that proves it rendered its
 *  body (the CTA label where there is one, the warning copy otherwise). */
const templates = [
  {
    name: "verification",
    element: <VerificationEmail url={url} />,
    expects: ["Verify email", url],
  },
  {
    name: "password-reset",
    element: <PasswordResetEmail url={url} />,
    expects: ["Reset password", url],
  },
  {
    name: "password-changed",
    element: <PasswordChangedEmail />,
    expects: ["Password changed", "please contact support immediately"],
    warning: true,
  },
  {
    name: "email-change-approval",
    element: <EmailChangeApprovalEmail url={url} newEmail={newEmail} />,
    expects: ["Approve email change", newEmail, url],
  },
  {
    name: "email-changed",
    element: <EmailChangedEmail newEmail={newEmail} />,
    expects: ["Email address changed", newEmail],
    warning: true,
  },
  {
    name: "delete-account-verification",
    element: <DeleteAccountVerificationEmail url={url} />,
    expects: ["Permanently delete my account", url],
  },
];

describe("email templates", () => {
  for (const { name, element, expects, warning } of templates) {
    test(`${name} renders through the shared layout`, async () => {
      const html = await render(element);

      for (const text of expects) {
        expect(html).toContain(text);
      }

      // Alpha colours (8-digit hex, rgba) render as no colour / the wrong
      // colour in Outlook and several webmail clients — every colour is opaque.
      expect(html).not.toMatch(/#[0-9a-f]{8}\b/i);
      expect(html).not.toMatch(/rgba?\(/i);
      // Warnings are the app's danger notice: red fill, ink rule.
      if (warning) {
        expect(html).toContain(`background-color:${emailColors.danger}`);
      }
    });

    test(`${name} keeps the app's neobrutalist rules`, async () => {
      const html = await render(element);

      // Hard offset shadows only: a non-zero third length is a blur.
      const shadows = [...html.matchAll(/box-shadow:([^;"]+)/g)].map((m) => m[1]);
      expect(shadows.length).toBeGreaterThan(0);
      for (const shadow of shadows) {
        expect(shadow).toMatch(/^\d+px \d+px 0 #000000$/);
      }
      // Square panels and 4px controls — nothing rounder.
      for (const [, px] of html.matchAll(/border-radius:(\d+)px/g)) {
        expect(Number(px)).toBeLessThanOrEqual(4);
      }
      expect(html).toContain(`border:2px solid ${emailColors.ink}`);
    });
  }

  /** The style attribute of the CTA link (the logo also uses the yellow fill,
   *  so a whole-document search can't tell which fill the button has). */
  function buttonStyle(html: string): string {
    const tag = html.match(/<a\b[^>]*token=example-token[^>]*>/)?.[0] ?? "";
    return tag.match(/style="([^"]*)"/)?.[1] ?? "";
  }

  test("CTA buttons use the yellow primary with ink text", async () => {
    const style = buttonStyle(await render(<VerificationEmail url={url} />));
    expect(style).toContain(`background-color:${emailColors.primary}`);
    expect(style).toContain(`color:${emailColors.ink}`);
  });

  test("delete-account uses the destructive button, not the primary one", async () => {
    const style = buttonStyle(
      await render(<DeleteAccountVerificationEmail url={url} />),
    );
    expect(style).toContain(`background-color:${emailColors.danger}`);
    expect(style).not.toContain(`background-color:${emailColors.primary}`);
  });
});
