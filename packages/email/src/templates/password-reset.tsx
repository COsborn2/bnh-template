import { Button, Section, Text } from "@react-email/components";
import { Layout } from "./layout.js";

interface PasswordResetEmailProps {
  url: string;
}

export function PasswordResetEmail({ url }: PasswordResetEmailProps) {
  return (
    <Layout preview="Reset your password">
      <Text style={heading}>Reset your password</Text>
      <Text style={paragraph}>
        We received a request to reset your password. Click the button below to
        choose a new one.
      </Text>
      <Section style={buttonWrap}>
        <Button style={button} href={url}>
          Reset Password
        </Button>
      </Section>
      <Text style={footnote}>
        This link expires in 1 hour. If you didn&apos;t request a password
        reset, you can safely ignore this email.
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
  margin: "0 0 28px",
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

export default function PasswordResetEmailPreview() {
  return (
    <PasswordResetEmail url="https://example.com/auth/reset-password?token=example-token" />
  );
}
