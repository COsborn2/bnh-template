import { Button, Section, Text } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

interface VerificationEmailProps {
  url: string;
}

export function VerificationEmail({ url }: VerificationEmailProps) {
  return (
    <Layout preview="Verify your email address">
      <Text style={emailStyles.heading}>Verify your email</Text>
      <Text style={emailStyles.paragraph}>
        Thanks for signing up! Click the button below to verify your email
        address and get started.
      </Text>
      <Section style={emailStyles.buttonWrap}>
        <Button style={emailStyles.primaryButton} href={url}>
          Verify email
        </Button>
      </Section>
      <Text style={emailStyles.footnote}>
        This link expires in 24 hours. If you didn&apos;t create an account, you
        can safely ignore this email.
      </Text>
    </Layout>
  );
}

export default function VerificationEmailPreview() {
  return (
    <VerificationEmail url="https://example.com/auth/verify-email?token=example-token" />
  );
}
