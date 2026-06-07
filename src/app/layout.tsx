import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { BookProvider } from "@/components/providers/BookProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-hebrew",
  subsets: ["hebrew"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FinanceApp",
  description: "Personal finance tracker — budgets, expenses, income",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinanceApp",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansHebrew.variable} antialiased`}
        suppressHydrationWarning
      >
        <LocaleProvider>
          <AuthProvider>
            <BookProvider>
              <ConfirmProvider>
                <AppShell>{children}</AppShell>
                <Toaster richColors position="top-center" />
              </ConfirmProvider>
            </BookProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

