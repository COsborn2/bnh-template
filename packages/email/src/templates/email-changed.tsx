import { Text, Section } from "@react-email/components";
import { Layout } from "./layout.js";

interface EmailChangedEmailProps {
  newEmail: string;
}

export function EmailChangedEmail({ newEmail }: EmailChangedEmailProps) {
  return (
    <Layout preview="Your email address has been changed">
      <Text style={heading}>Email address changed</Text>
      <Text style={paragraph}>
        The email address on your account has been changed to:
      </Text>
      <Section style={emailBox}>
        <Text style={emailText}>{newEmail}</Text>
      </Section>
      <Text style={paragraph}>
        If you made this change, no further action is needed.
      </Text>
      <Section style={warningBox}>
        <Text style={warningText}>
          If you did not make this change, please contact support immediately
          to secure your account.
        </Text>
      </Section>
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

const warningBox = {
  backgroundColor: "#2a2020",
  border: "1px solid #fb718533",
  borderRadius: "8px",
  padding: "16px",
  margin: "8px 0 0",
};

const warningText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#fb7185",
  margin: "0",
};

export default function EmailChangedEmailPreview() {
  return <EmailChangedEmail newEmail="newemail@example.com" />;
}
