import { Text, Section } from "@react-email/components";
import { emailStyles, Layout } from "./layout.js";

export function PasswordChangedEmail() {
  return (
    <Layout preview="Your password has been changed">
      <Text style={emailStyles.heading}>Password changed</Text>
      <Text style={emailStyles.paragraphTight}>
        Your password was successfully changed. If you made this change, no
        further action is needed.
      </Text>
      <Section style={emailStyles.warningPanel}>
        <Text style={emailStyles.warningText}>
          If you did not make this change, please contact support immediately.
        </Text>
      </Section>
    </Layout>
  );
}

export default function PasswordChangedEmailPreview() {
  return <PasswordChangedEmail />;
}
