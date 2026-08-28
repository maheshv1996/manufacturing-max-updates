import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted Inter variable font — zero runtime CDN dependency so the
// offline edition renders identically with the internet cable unplugged
// and air-gapped builds never need to fetch fonts.
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
});

// Dynamic window/tab title: when the tenant has configured branding (a
// branding Setting row exists), the default title leads with the company
// name — "<Company> — Manufacturing Max". Without a row (fresh install,
// offline first boot) it stays the clean app name and NEVER leaks the
// sample default company. Pages that set their own title get composed via
// the template: "Page Title | Manufacturing Max".
export async function generateMetadata(): Promise<Metadata> {
  let appName = "ManufacturingMax - Enterprise Edition";
  let company: string | null = null;
  try {
    const row = await prisma.setting.findUnique({ where: { key: "branding" } });
    if (row) {
      const b = {
        ...DEFAULT_BRANDING,
        ...(JSON.parse(row.value) as Partial<typeof DEFAULT_BRANDING>),
      };
      if (b.appName?.trim()) appName = b.appName.trim();
      if (b.companyName?.trim()) company = b.companyName.trim();
    }
  } catch {
    // DB unavailable (first boot / offline hiccup) — fall back to defaults.
  }
  const defaultTitle = company ? `${company} — ${appName}` : appName;
  return {
    title: {
      default: defaultTitle,
      template: `%s | ${appName}`,
    },
    description:
      "Real-time OEE, machine availability, and downtime analytics dashboard.",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "MfgMax",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

import AppShell from "@/app/components/layout/AppShell";
import ErrorBoundary from "@/app/components/shared/ErrorBoundary";
import { headers } from "next/headers";
import { DEFAULT_BRANDING, getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { ToastContainer } from "@/app/components/ui/ToastContainer";

import { getUserFromHeaders } from "@/lib/permissions";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  const settings = await getSettings();
  const branding = settings.branding || {
    appName: "Manufacturing Max",
    tagline: DEFAULT_BRANDING.tagline,
    accentColor: "#3b82f6",
    logoUrl: "",
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${inter.variable} h-full antialiased bg-[#0b0c0e] text-[#f9fafb]`}
      style={
        {
          "--color-accent": branding.accentColor,
          backgroundColor: "#0b0c0e",
          color: "#f9fafb",
        } as React.CSSProperties
      }
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.setProperty('--bg', '#0b0c0e');
                  document.documentElement.style.setProperty('--surface-1', '#141519');
                  document.documentElement.style.setProperty('--surface-2', '#1b1d23');
                  document.documentElement.style.setProperty('--surface-3', '#22252c');
                  document.documentElement.style.setProperty('--text-1', '#f9fafb');
                  document.documentElement.style.setProperty('--text-2', '#d1d5db');
                  document.documentElement.style.setProperty('--text-3', '#6b7280');
                  document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
                } catch (e) { /* no-op */ }
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full bg-bg text-text-1 font-sans flex"
        style={{ backgroundColor: "#0b0c0e", color: "#f9fafb" }}
      >
        <AppShell
          user={user}
          branding={branding}
          activeDepartments={settings.activeDepartments}
          onboardingComplete={settings.onboardingComplete}
          onboardingSkipped={settings.onboardingSkipped}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppShell>
        <ToastContainer />
      </body>
    </html>
  );
}
