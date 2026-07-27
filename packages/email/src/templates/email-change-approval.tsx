import { Button, Section, Text } from "@react-email/components";
import { Layout } from "./layout.js";

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
      <Text style={heading}>Approve your email change</Text>
      <Text style={paragraph}>
        We received a request to change the email address on your account to:
      </Text>
      <Section style={emailBox}>
        <Text style={emailText}>{newEmail}</Text>
      </Section>
      <Text style={paragraph}>
        Click the button below to approve this change. After you approve it, a
        verification link will be sent to the new address to complete the
        change.
      </Text>
      <Section style={buttonWrap}>
        <Button style={button} href={url}>
          Approve email change
        </Button>
      </Section>
      <Text style={footnote}>
        This link expires in one hour. If you didn&apos;t request this change,
        don&apos;t click the button — your email address will stay the same.
        For your security, consider changing your password.
      </Text>
    </Layout>
  );
}

const heading = {
  fontSize: "22px",
  fontWeight: "700" as const,
  color: "#f0ebe3",
  margin: "0 0 16px",
};

const paragraph = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#9a9389",
  margin: "0 0 16px",
};

const emailBox = {
  backgroundColor: "#222222",
  border: "1px solid #333333",
  borderRadius: "8px",
  padding: "14px 16px",
  margin: "0 0 16px",
};

const emailText = {
  color: "#e8d5b5",
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: "15px",
  fontWeight: "700" as const,
  lineHeight: "22px",
  margin: "0",
  wordBreak: "break-word" as const,
};

const buttonWrap = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#a78bfa",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "14px 32px",
};

const footnote = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#6b655c",
  marginTop: "28px",
};

export default function EmailChangeApprovalEmailPreview() {
  return (
    <EmailChangeApprovalEmail
      url="https://example.com/api/auth/verify-email?token=example-token&callbackURL=%2F"
      newEmail="newemail@example.com"
    />
  );
}
