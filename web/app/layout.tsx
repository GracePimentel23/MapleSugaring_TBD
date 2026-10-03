import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import { AccessProvider } from "@/components/auth/AccessContext";
import AppShell from "@/components/layout/AppShell";
import { loadAuth } from "@/lib/api/server";
import { loadShell } from "@/lib/data/source";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maple Sugaring",
  description: "Dashboard for the school maple sugaring club",
};

// Every page reads live sensor data, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Sign-in is optional: signed-out visitors get the guest view. The worker enforces every
  // permission; `access` only tells the UI what to show (see docs/RBAC.md).
  const [access, shell] = await Promise.all([loadAuth(), loadShell()]);

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AccessProvider access={access}>
          <AppShell shell={shell}>{children}</AppShell>
        </AccessProvider>
      </body>
    </html>
  );
}
