import { Text, Section } from "@react-email/components";
import { Layout } from "./layout.js";

export function PasswordChangedEmail() {
  return (
    <Layout preview="Your password has been changed">
      <Text style={heading}>Password changed</Text>
      <Text style={paragraph}>
        Your password was successfully changed. If you made this change, no
        further action is needed.
      </Text>
      <Section style={warningBox}>
        <Text style={warningText}>
          If you did not make this change, please contact support immediately.
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
  margin: "0 0 20px",
};

const warningBox = {
  backgroundColor: "#2a2020",
  border: "1px solid #fb718533",
  borderRadius: "8px",
  padding: "16px",
};

const warningText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#fb7185",
  margin: "0",
};

export default function PasswordChangedEmailPreview() {
  return <PasswordChangedEmail />;
}
