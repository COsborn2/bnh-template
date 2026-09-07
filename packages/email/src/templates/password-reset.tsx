import { Button, Section, Text } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

interface PasswordResetEmailProps {
  url: string;
}

export function PasswordResetEmail({ url }: PasswordResetEmailProps) {
  return (
    <Layout preview="Reset your password">
      <Text style={emailStyles.heading}>Reset your password</Text>
      <Text style={emailStyles.paragraph}>
        We received a request to reset your password. Click the button below to
        choose a new one.
      </Text>
      <Section style={emailStyles.buttonWrap}>
        <Button style={emailStyles.primaryButton} href={url}>
          Reset password
        </Button>
      </Section>
      <Text style={emailStyles.footnote}>
        This link expires in 1 hour. If you didn&apos;t request a password
        reset, you can safely ignore this email.
      </Text>
    </Layout>
  );
}

export default function PasswordResetEmailPreview() {
  return (
    <PasswordResetEmail url="https://example.com/auth/reset-password?token=example-token" />
  );
}
