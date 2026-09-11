import { Button, Section, Text } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

interface EmailChangeApprovalEmailProps {
  url: string;
  newEmail: string;
}

/**
 * Sent to the CURRENT address when a change of email is requested. Clicking
 * the button authorizes the change; Better Auth then emails a verification
 * link to the new address, and only that second click updates the account.
 */
export function EmailChangeApprovalEmail({
  url,
  newEmail,
}: EmailChangeApprovalEmailProps) {
  return (
    <Layout preview="Approve your email change">
      <Text style={emailStyles.heading}>Approve your email change</Text>
      <Text style={emailStyles.paragraphTight}>
        We received a request to change the email address on your account to:
      </Text>
      <Section style={emailBox}>
        <Text style={emailStyles.dataText}>{newEmail}</Text>
      </Section>
      <Text style={emailStyles.paragraphTight}>
        Click the button below to approve this change. After you approve it, a
        verification link will be sent to the new address to complete the
        change.
      </Text>
      <Section style={emailStyles.buttonWrap}>
        <Button style={emailStyles.primaryButton} href={url}>
          Approve email change
        </Button>
      </Section>
      <Text style={emailStyles.footnote}>
        This link expires in one hour. If you didn&apos;t request this change,
        don&apos;t click the button — your email address will stay the same. For
        your security, consider changing your password.
      </Text>
    </Layout>
  );
}

const emailBox = {
  ...emailStyles.dataPanel,
  margin: "0 0 16px",
};

export default function EmailChangeApprovalEmailPreview() {
  return (
    <EmailChangeApprovalEmail
      url="https://example.com/api/auth/verify-email?token=example-token&callbackURL=%2F"
      newEmail="newemail@example.com"
    />
  );
}
