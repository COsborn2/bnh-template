import { AuthShell } from "@/components/auth/auth-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Turnstile injects its widget script from this origin only after
          hydration; preconnecting lets DNS+TLS overlap with page load. React
          hoists the tag into <head>. */}
      <link rel="preconnect" href="https://challenges.cloudflare.com" />
      <AuthShell>{children}</AuthShell>
    </>
  );
}
