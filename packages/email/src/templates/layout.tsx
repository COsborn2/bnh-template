import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";
import type { ReactNode } from "react";

const APP_NAME = process.env.APP_NAME || "MyApp";

interface LayoutProps {
  preview: string;
  children: ReactNode;
}

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Fraunces"
          fallbackFontFamily="Georgia"
          webFont={{
            url: "https://fonts.gstatic.com/s/fraunces/v31/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nBEsQMo5m1.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={header}>
            <Row>
              <Column>
                <Text style={logo}>{APP_NAME}</Text>
              </Column>
            </Row>
          </Section>

          {/* Decorative accent bar */}
          <Section style={accentBar} />

          {/* Content card */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} {APP_NAME}
            </Text>
            <Text style={footerSubtext}>
              Sent by {APP_NAME}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// --- Theme colors (from app design system) ---
const colors = {
  bg: "#0f0f0f",
  bgRaised: "#1a1a1a",
  bgCard: "#222222",
  border: "#333333",
  text: "#f0ebe3",
  textMuted: "#9a9389",
  textFaint: "#6b655c",
  primary: "#e8d5b5",
  accentPurple: "#a78bfa",
  accentGreen: "#22c55e",
};

const body = {
  backgroundColor: colors.bg,
  fontFamily:
    '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container = {
  margin: "0 auto",
  padding: "40px 16px",
  maxWidth: "520px",
};

const header = {
  padding: "0 0 20px",
};

const logo = {
  fontFamily: '"Fraunces", Georgia, serif',
  color: colors.primary,
  fontSize: "28px",
  fontWeight: "700" as const,
  margin: "0",
  letterSpacing: "-0.5px",
};

const accentBar = {
  background: `linear-gradient(90deg, ${colors.accentPurple}, ${colors.accentGreen})`,
  height: "3px",
  borderRadius: "3px",
};

const content = {
  backgroundColor: colors.bgRaised,
  borderRadius: "12px",
  padding: "36px 32px",
  marginTop: "0",
  border: `1px solid ${colors.border}`,
  borderTop: "none",
  borderTopLeftRadius: "0",
  borderTopRightRadius: "0",
};

const footer = {
  padding: "24px 0 0",
};

const hr = {
  borderColor: colors.border,
  margin: "0 0 20px",
};

const footerText = {
  color: colors.textMuted,
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0",
  textAlign: "center" as const,
};

const footerSubtext = {
  color: colors.textFaint,
  fontSize: "11px",
  lineHeight: "16px",
  margin: "4px 0 0",
  textAlign: "center" as const,
};

export default function LayoutPreview() {
  return (
    <Layout preview="Preview of the email layout">
      <Text style={{ color: colors.text, fontSize: "20px", fontWeight: "700" as const, margin: "0 0 12px" }}>
        Example Heading
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: "15px", lineHeight: "24px", margin: "0" }}>
        This is a preview of the shared email layout.
      </Text>
    </Layout>
  );
}
