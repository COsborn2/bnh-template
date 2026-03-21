import { Button, Section, Text } from "@react-email/components";
import { Layout } from "./layout.js";

interface VerificationEmailProps {
  url: string;
}

export function VerificationEmail({ url }: VerificationEmailProps) {
  return (
    <Layout preview="Verify your email address">
      <Text style={heading}>Verify your email</Text>
      <Text style={paragraph}>
        Thanks for signing up! Click the button below to verify your email
        address and get started.
      </Text>
      <Section style={buttonWrap}>
        <Button style={button} href={url}>
          Verify Email
        </Button>
      </Section>
      <Text style={footnote}>
        This link expires in 24 hours. If you didn&apos;t create an account, you
        can safely ignore this email.
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

export default function VerificationEmailPreview() {
  return (
    <VerificationEmail url="https://example.com/auth/verify-email?token=example-token" />
  );
}
