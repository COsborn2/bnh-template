import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "MyApp";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: "A modern full-stack web application",
};

const themeScript = `(function(){try{var p=localStorage.getItem('theme-preference');var t=p==='light'?'light':p==='dark'?'dark':window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add('dark')}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">
        <ImpersonationBanner />
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
