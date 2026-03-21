import { Resend } from "resend";
import { createElement } from "react";
import { VerificationEmail } from "./templates/verification.js";
import { PasswordResetEmail } from "./templates/password-reset.js";
import { PasswordChangedEmail } from "./templates/password-changed.js";

const APP_NAME = process.env.APP_NAME || "MyApp";
const EMAIL_FROM =
  process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`;

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resend = new Resend(apiKey);
  return resend;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Action URL (verification link, reset link, etc.) — logged in dev mode */
  url?: string;
}

function logEmailToConsole(to: string, subject: string, url?: string, reason?: string) {
  console.log(`[email] ${reason ?? "Email not sent"}`);
  console.log(`[email] To: ${to}`);
  console.log(`[email] Subject: ${subject}`);
  if (url) {
    console.log(`[email] Action URL: ${url}`);
  }
}

async function sendEmail({ to, subject, react, url }: SendEmailOptions) {
  const client = getResendClient();

  if (!client) {
    logEmailToConsole(to, subject, url, "(dev mode) No RESEND_API_KEY set");
    return { id: "dev-mode", error: null };
  }

  const { data, error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    react,
  });

  if (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
    logEmailToConsole(to, subject, url, "Falling back to console output");
    return { id: null, error };
  }

  return { id: data?.id ?? null, error: null };
}

export async function sendVerificationEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: `Verify your email — ${APP_NAME}`,
    react: createElement(VerificationEmail, { url }),
    url,
  });
}

export async function sendPasswordResetEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: `Reset your password — ${APP_NAME}`,
    react: createElement(PasswordResetEmail, { url }),
    url,
  });
}

export async function sendPasswordChangedEmail(to: string) {
  return sendEmail({
    to,
    subject: `Your password has been changed — ${APP_NAME}`,
    react: createElement(PasswordChangedEmail),
  });
}

