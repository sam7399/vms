import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@vms/ui";
import { BrandFooter } from "@/components/brand-footer";
import { NotificationToaster } from "@/components/notification-toaster";
import { SosBanner } from "@/components/sos-banner";
import { getBrand } from "@/lib/brand";

const brand = getBrand();

export const metadata: Metadata = {
  title: brand.productName + " | Built by Personify Crafters",
  description: brand.description,
  authors: [{ name: "Personify Crafters" }],
  themeColor: "#7c3aed",
  openGraph: {
    title: brand.ogTitle,
    description: brand.description,
    type: "website",
    siteName: brand.shortName + " · " + brand.tagline,
  },
  icons: { icon: brand.faviconSrc },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" data-density="compact" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://rsms.me/inter/inter.css"
        />
      </head>
      <body suppressHydrationWarning className="bg-surface-0 text-text-primary">
        <I18nProvider>
          <ToastProvider>
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
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
