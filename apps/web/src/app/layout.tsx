import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { BrandFooter } from "@/components/brand-footer";
import { NotificationToaster } from "@/components/notification-toaster";
import { SosBanner } from "@/components/sos-banner";

export const metadata: Metadata = {
  title: "VMS — Visitor Management System | TSI by Personify Crafters",
  description:
    "Enterprise Visitor & Workforce Management — Built by Personify Crafters for The Studio Infinito.",
  authors: [{ name: "Personify Crafters" }],
  themeColor: "#7c3aed",
  openGraph: {
    title: "VMS — Visitor Management System | TSI",
    description:
      "Enterprise visitor & workforce management by Personify Crafters for The Studio Infinito.",
    type: "website",
    siteName: "The Studio Infinito VMS",
  },
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning className="bg-surface-950">
        <I18nProvider>
          <AuthProvider>
            <div className="relative min-h-screen flex flex-col bg-surface-950 text-white overflow-x-hidden">
              {/* Ambient brand backdrop */}
              <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0 bg-brand-radial"
              />
              <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 top-0 h-px bg-brand-gradient z-50"
              />
              <div className="relative z-10 flex-1">{children}</div>
              <BrandFooter />
            </div>
            <SosBanner />
            <NotificationToaster />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
