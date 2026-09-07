import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_URL_IS_CONFIGURED } from "@/lib/site";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

// Self-hosted via next/font: the files are downloaded at build time and served
// from /_next/static, so no runtime request goes to Google Fonts. The CSS
// variables are mapped onto --font-body / --font-display in globals.css.
const dmSans = DM_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "MyApp";
const description = "A modern full-stack web application";

export const metadata: Metadata = {
  // Canonical production origin — resolves every relative canonical/OG URL
  // below and in per-page metadata, and lets an opengraph-image file
  // convention emit absolute og:image URLs. Only set once NEXT_PUBLIC_APP_URL
  // is configured so a localhost fallback never leaks into deployed metadata.
  ...(SITE_URL_IS_CONFIGURED ? { metadataBase: new URL(SITE_URL) } : {}),
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description,
  // If you add app/opengraph-image.(png|tsx) and a page exports its own
  // openGraph/twitter, list the image there explicitly
  // (images: [{ url, width, height, alt }]) — Next merges those objects
  // wholesale and silently drops the file-convention image.
  openGraph: {
    siteName: appName,
    type: "website",
    title: appName,
    description,
  },
  twitter: {
    card: "summary",
    title: appName,
    description,
  },
};

const themeScript = `(function(){try{var p=localStorage.getItem('theme-preference');var t=p==='light'?'light':p==='dark'?'dark':window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add('dark')}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">
        <ImpersonationBanner />
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
