import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import LoginScreen from "@/components/auth/LoginScreen";
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
  // Sign-in is enforced by the worker; this only decides what to show. When the worker is off
  // (sample data) or has AUTH_PROVIDER unset, there is no gate.
  const auth = await loadAuth();
  const signedOut = auth?.authEnabled === true && !auth.user;
  const shell = signedOut ? null : await loadShell();

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {shell ? (
          <AppShell shell={shell} user={auth?.user ?? null}>{children}</AppShell>
        ) : (
          <LoginScreen />
        )}
      </body>
    </html>
  );
}
