import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { BrandFooter } from "@/components/brand-footer";
import { NotificationToaster } from "@/components/notification-toaster";

export const metadata: Metadata = {
  title: "VMS · Enterprise Visitor & Workforce Management",
  description:
    "Real-time visitor and contractor workforce management — by TheStudioInfinito × Personify Crafters",
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
      <body suppressHydrationWarning>
        <I18nProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
              <div className="flex-1">{children}</div>
              <BrandFooter />
            </div>
            <NotificationToaster />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
