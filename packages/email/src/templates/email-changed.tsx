import { Text, Section } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

interface EmailChangedEmailProps {
  newEmail: string;
}

export function EmailChangedEmail({ newEmail }: EmailChangedEmailProps) {
  return (
    <Layout preview="Your email address has been changed">
      <Text style={emailStyles.heading}>Email address changed</Text>
      <Text style={emailStyles.paragraphTight}>
        The email address on your account has been changed to:
      </Text>
      <Section style={emailBox}>
        <Text style={emailStyles.dataText}>{newEmail}</Text>
      </Section>
      <Text style={emailStyles.paragraphTight}>
        If you made this change, no further action is needed.
      </Text>
      <Section style={warningBox}>
        <Text style={emailStyles.warningText}>
          If you did not make this change, please contact support immediately to
          secure your account.
        </Text>
      </Section>
    </Layout>
  );
}

const emailBox = {
  ...emailStyles.dataPanel,
  margin: "0 0 16px",
};

const warningBox = {
  ...emailStyles.warningPanel,
  margin: "8px 0 0",
};

export default function EmailChangedEmailPreview() {
  return <EmailChangedEmail newEmail="newemail@example.com" />;
}
