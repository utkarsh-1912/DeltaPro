import type { Metadata } from "next";
import { Archivo, Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import { DBHydrationProvider } from "@/components/db-hydration-provider";

import AuthGate from "@/components/auth-gate";
import { AppLayout } from "@/components/app-layout";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Archivo({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: "variable", axes: ["wdth"] });

export const metadata: Metadata = {
  title: "DeltaPro — Workforce & HR Platform",
  description: "Attendance, leave, rotas, projects and people in one enterprise HR platform.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} ${display.variable} font-body antialiased`} suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <DBHydrationProvider>
              <AuthGate>
                <AppLayout>
                  {children}
                </AppLayout>
              </AuthGate>
            </DBHydrationProvider>
            <Toaster />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
