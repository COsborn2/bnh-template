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
import type { CSSProperties, ReactNode } from "react";

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
            <Text style={footerSubtext}>Sent by {APP_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// --- Theme colors (from app design system) ---
//
// Every colour is opaque on purpose: email clients (Outlook, several webmail
// apps) render 8-digit hex / rgba borders as no border or the wrong colour,
// so "translucent" accents are pre-blended against the surface they sit on.
export const emailColors = {
  bg: "#0f0f0f",
  bgRaised: "#1a1a1a",
  bgPanel: "#222222",
  border: "#333333",
  borderSubtle: "#2a2a2a",
  text: "#f0ebe3",
  textMuted: "#9a9389",
  textFaint: "#6b655c",
  primary: "#e8d5b5",
  accent: "#a78bfa",
  accentGreen: "#22c55e",
  warningBg: "#2a2020",
  warningBorder: "#5a2a34",
  warningText: "#ff9daf",
};

// The buttons are declared outside `emailStyles` so `dangerButton` can derive
// from `primaryButton` (a sibling key is not in scope while the object literal
// is still being built) and so both carry a nameable `CSSProperties` type —
// an inline spread would make the exported type expand every csstype member,
// which the declaration emitter refuses as non-portable.
// The explicit border and lineHeight keep the button's box size stable across
// clients (some add a default border, some size the link by line box).
const primaryButton: CSSProperties = {
  backgroundColor: emailColors.accent,
  border: `1px solid ${emailColors.accent}`,
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  lineHeight: "18px",
  padding: "14px 32px",
  textAlign: "center",
  textDecoration: "none",
};

/** Destructive actions (account deletion). */
const dangerButton: CSSProperties = {
  ...primaryButton,
  backgroundColor: "#fb7185",
  border: "1px solid #fb7185",
};

/** Shared styles for template content. Templates should consume these rather
 *  than re-declaring their own constants so the emails stay visually
 *  consistent and a design change lands in one place. */
export const emailStyles = {
  heading: {
    color: emailColors.text,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 16px",
  },
  paragraph: {
    color: emailColors.textMuted,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 28px",
  },
  paragraphTight: {
    color: emailColors.textMuted,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  buttonWrap: {
    textAlign: "center",
  },
  primaryButton,
  dangerButton,
  // `Text` defaults to `margin: 16px 0`, so set every side — a bare marginTop
  // would leave a stray bottom margin under the last line of the card.
  footnote: {
    color: emailColors.textFaint,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "28px 0 0",
  },
  dataPanel: {
    backgroundColor: emailColors.bgPanel,
    border: `1px solid ${emailColors.border}`,
    borderRadius: "8px",
    padding: "14px 16px",
  },
  dataText: {
    color: emailColors.primary,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "22px",
    margin: "0",
    wordBreak: "break-word",
  },
  warningPanel: {
    backgroundColor: emailColors.warningBg,
    border: `1px solid ${emailColors.warningBorder}`,
    borderRadius: "8px",
    padding: "16px",
  },
  warningText: {
    color: emailColors.warningText,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
} satisfies Record<string, CSSProperties>;

const body: CSSProperties = {
  backgroundColor: emailColors.bg,
  fontFamily:
    '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container: CSSProperties = {
  margin: "0 auto",
  padding: "40px 16px",
  maxWidth: "520px",
};

const header: CSSProperties = {
  padding: "0 0 20px",
};

const logo: CSSProperties = {
  fontFamily: '"Fraunces", Georgia, serif',
  color: emailColors.primary,
  fontSize: "28px",
  fontWeight: "700",
  margin: "0",
  letterSpacing: "-0.5px",
};

const accentBar: CSSProperties = {
  background: `linear-gradient(90deg, ${emailColors.accent}, ${emailColors.accentGreen})`,
  height: "3px",
  borderRadius: "3px",
};

const content: CSSProperties = {
  backgroundColor: emailColors.bgRaised,
  borderRadius: "12px",
  padding: "36px 32px",
  marginTop: "0",
  border: `1px solid ${emailColors.border}`,
  borderTop: "none",
  borderTopLeftRadius: "0",
  borderTopRightRadius: "0",
};

const footer: CSSProperties = {
  padding: "24px 0 0",
};

const hr: CSSProperties = {
  borderColor: emailColors.border,
  margin: "0 0 20px",
};

const footerText: CSSProperties = {
  color: emailColors.textMuted,
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0",
  textAlign: "center",
};

const footerSubtext: CSSProperties = {
  color: emailColors.textFaint,
  fontSize: "11px",
  lineHeight: "16px",
  margin: "4px 0 0",
  textAlign: "center",
};

export default function LayoutPreview() {
  return (
    <Layout preview="Preview of the email layout">
      <Text style={emailStyles.heading}>Example Heading</Text>
      <Text style={emailStyles.paragraph}>
        This is a preview of the shared email layout.
      </Text>
    </Layout>
  );
}
