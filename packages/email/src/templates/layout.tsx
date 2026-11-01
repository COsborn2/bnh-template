import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

const APP_NAME = process.env.APP_NAME || "MyApp";

// The app's typefaces. Clients that load web fonts (Apple Mail, iOS Mail)
// get Space Grotesk / Space Mono; the rest fall back to the system stack.
const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Space+Mono:wght@700&display=swap";

interface LayoutProps {
  preview: string;
  children: ReactNode;
}

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head>
        {/* Light-only: keeps Apple Mail from auto-darkening the cream paper
            and yellow fills into something that no longer reads as the app. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* The app name on a tilted yellow block, as on the auth pages. */}
          <Section style={header}>
            <Text style={logoWrap}>
              <span style={logo}>{APP_NAME}</span>
            </Text>
          </Section>

          <Section style={content}>{children}</Section>

          <Section style={footer}>
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

// --- Theme colors (the web app's light neobrutalist palette) ---
//
// Mirrors apps/web/src/app/theme.css: cream paper, white cards, black ink for
// rules, shadows and text, and the yellow primary / red fill for actions.
// Every colour is opaque on purpose: email clients (Outlook, several webmail
// apps) render 8-digit hex / rgba as no colour or the wrong colour.
export const emailColors = {
  /** --bnh-bg: cream page background. */
  bg: "#fff7e8",
  /** --bnh-surface: the content card. */
  surface: "#ffffff",
  /** --bnh-surface-2: inset data panels. */
  surfaceAlt: "#efe7d6",
  /** --app-ink: rules, hard shadows, and text on bright fills. */
  ink: "#000000",
  text: "#000000",
  /** --bnh-text-dim: body copy. */
  textDim: "#3d3a35",
  /** --bnh-text-mute: footnotes and the footer. */
  textMute: "#5e584f",
  /** --bnh-primary: primary buttons and the wordmark block. */
  primary: "#ffdc58",
  /** --app-fill-red: destructive buttons and warning notices. */
  danger: "#ff8f8f",
};

const fontSans =
  '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const fontMono =
  '"Space Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

/** 2px solid ink: the app's rule on every panel and control. */
const rule = `2px solid ${emailColors.ink}`;

// Hard offset shadows, never blurred (--bnh-control-shadow / --bnh-raised-shadow).
// Outlook for Windows ignores box-shadow, which leaves the 2px rule on its own.
const controlShadow = `3px 3px 0 ${emailColors.ink}`;
const raisedShadow = `4px 4px 0 ${emailColors.ink}`;

// The buttons are declared outside `emailStyles` so `dangerButton` can derive
// from `primaryButton` (a sibling key is not in scope while the object literal
// is still being built) and so both carry a nameable `CSSProperties` type —
// an inline spread would make the exported type expand every csstype member,
// which the declaration emitter refuses as non-portable.
// The explicit lineHeight keeps the button's box size stable across clients
// (some size the link by line box). Bright fills always carry black text.
const primaryButton: CSSProperties = {
  backgroundColor: emailColors.primary,
  border: rule,
  borderRadius: "4px",
  boxShadow: controlShadow,
  color: emailColors.ink,
  fontFamily: fontSans,
  fontSize: "15px",
  fontWeight: "700",
  lineHeight: "18px",
  padding: "12px 24px",
  textAlign: "center",
  textDecoration: "none",
};

/** Destructive actions (account deletion). */
const dangerButton: CSSProperties = {
  ...primaryButton,
  backgroundColor: emailColors.danger,
};

/** Shared styles for template content. Templates should consume these rather
 *  than re-declaring their own constants so the emails stay visually
 *  consistent and a design change lands in one place. */
export const emailStyles = {
  // The app's `font-display` headings: bold, uppercase, tightly tracked.
  heading: {
    color: emailColors.text,
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "30px",
    letterSpacing: "-0.5px",
    margin: "0 0 16px",
    textTransform: "uppercase",
  },
  paragraph: {
    color: emailColors.textDim,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 28px",
  },
  paragraphTight: {
    color: emailColors.textDim,
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
    color: emailColors.textMute,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "28px 0 0",
  },
  dataPanel: {
    backgroundColor: emailColors.surfaceAlt,
    border: rule,
    borderRadius: "0",
    padding: "12px 14px",
  },
  dataText: {
    color: emailColors.ink,
    fontFamily: fontMono,
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "22px",
    margin: "0",
    wordBreak: "break-word",
  },
  /** The app's danger notice: red fill, ink rule, ink text. */
  warningPanel: {
    backgroundColor: emailColors.danger,
    border: rule,
    borderRadius: "0",
    padding: "12px 14px",
  },
  warningText: {
    color: emailColors.ink,
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: "20px",
    margin: "0",
  },
} satisfies Record<string, CSSProperties>;

const body: CSSProperties = {
  backgroundColor: emailColors.bg,
  color: emailColors.text,
  fontFamily: fontSans,
  margin: "0",
  padding: "0",
};

const container: CSSProperties = {
  margin: "0 auto",
  maxWidth: "520px",
  padding: "40px 16px 32px",
};

const header: CSSProperties = {
  margin: "0 0 24px",
};

const logoWrap: CSSProperties = {
  margin: "0",
  textAlign: "center",
};

/** The auth pages' wordmark: yellow block, ink rule, 4px corners, hard
 *  shadow, tilted -2deg. Clients without `transform` show it level. */
const logo: CSSProperties = {
  backgroundColor: emailColors.primary,
  border: rule,
  borderRadius: "4px",
  boxShadow: controlShadow,
  color: emailColors.ink,
  display: "inline-block",
  fontSize: "26px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  lineHeight: "34px",
  padding: "2px 16px",
  transform: "rotate(-2deg)",
};

const content: CSSProperties = {
  backgroundColor: emailColors.surface,
  border: rule,
  borderRadius: "0",
  boxShadow: raisedShadow,
  padding: "32px 32px 30px",
};

const footer: CSSProperties = {
  padding: "28px 0 0",
};

const footerText: CSSProperties = {
  color: emailColors.textMute,
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0",
  textAlign: "center",
};

const footerSubtext: CSSProperties = {
  color: emailColors.textMute,
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
