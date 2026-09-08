import { Button, Section, Text } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

interface DeleteAccountVerificationEmailProps {
  url: string;
}

export function DeleteAccountVerificationEmail({
  url,
}: DeleteAccountVerificationEmailProps) {
  return (
    <Layout preview="Confirm your account deletion">
      <Text style={emailStyles.heading}>Confirm account deletion</Text>
      <Text style={emailStyles.paragraph}>
        We received a request to permanently delete your account. To finish,
        click the button below. This <strong>cannot be undone</strong>.
      </Text>
      <Text style={emailStyles.paragraph}>
        Deleting your account permanently removes your profile and all data
        associated with it.
      </Text>
      <Section style={emailStyles.buttonWrap}>
        <Button style={emailStyles.dangerButton} href={url}>
          Permanently delete my account
        </Button>
      </Section>
      <Text style={emailStyles.footnote}>
        This link expires in 24 hours. If you didn&apos;t request this, you can
        safely ignore this email — your account stays exactly as it is. For your
        security, consider changing your password.
      </Text>
    </Layout>
  );
}

export default function DeleteAccountVerificationEmailPreview() {
  return (
    <DeleteAccountVerificationEmail url="https://example.com/api/auth/delete-user/callback?token=example-token&callbackURL=/" />
  );
}
