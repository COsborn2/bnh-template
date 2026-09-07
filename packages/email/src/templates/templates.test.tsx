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

      // 8-digit hex (alpha) borders render as no border / the wrong colour in
      // Outlook and several webmail clients — the warning panel must use the
      // opaque token instead.
      expect(html).not.toContain("#fb718533");
      if (warning) {
        expect(html).toContain(emailColors.warningBorder);
        expect(html).toContain(emailColors.warningText);
      }
    });
  }

  test("delete-account uses the destructive button, not the primary one", async () => {
    const html = await render(<DeleteAccountVerificationEmail url={url} />);
    expect(html).toContain("background-color:#fb7185");
    expect(html).not.toContain(`background-color:${emailColors.accent}`);
  });
});
