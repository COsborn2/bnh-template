import { Button, Section, Text } from "@react-email/components";
import { Layout } from "./layout.js";

interface DeleteAccountVerificationEmailProps {
  url: string;
}

export function DeleteAccountVerificationEmail({
  url,
}: DeleteAccountVerificationEmailProps) {
  return (
    <Layout preview="Confirm your account deletion">
      <Text style={heading}>Confirm account deletion</Text>
      <Text style={paragraph}>
        We received a request to permanently delete your account. To finish,
        click the button below. This <strong>cannot be undone</strong>.
      </Text>
      <Text style={paragraph}>
        Deleting your account permanently removes your profile and all data
        associated with it.
      </Text>
      <Section style={buttonWrap}>
        <Button style={button} href={url}>
          Permanently delete my account
        </Button>
      </Section>
      <Text style={footnote}>
        This link expires in 24 hours. If you didn&apos;t request this, you can
        safely ignore this email — your account stays exactly as it is. For
        your security, consider changing your password.
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
  margin: "0 0 20px",
};

const buttonWrap = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#fb7185",
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

export default function DeleteAccountVerificationEmailPreview() {
  return (
    <DeleteAccountVerificationEmail url="https://example.com/api/auth/delete-user/callback?token=example-token&callbackURL=/" />
  );
}
