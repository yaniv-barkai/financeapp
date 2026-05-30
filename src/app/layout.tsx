import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { BookProvider } from "@/components/providers/BookProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { Navbar } from "@/components/layout/Navbar";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { QuickAddFab } from "@/components/transactions/QuickAddFab";
import { PwaInit } from "@/components/layout/PwaInit";
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

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <GlobalSearch />
      <main className="sm:ps-56 pt-14 pb-20 sm:pb-6 min-h-screen">
        <div className="mx-auto max-w-5xl p-4 sm:p-6">{children}</div>
      </main>
      <QuickAddFab />
      <PwaInit />
    </div>
  );
}
