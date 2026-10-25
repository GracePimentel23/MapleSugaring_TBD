import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import BatchStateProvider from "@/components/data/BatchStateProvider";
import AppShell from "@/components/layout/AppShell";
import LiveProvider from "@/components/live/LiveProvider";
import ClubSettingsProvider from "@/components/session/ClubSettingsProvider";
import SessionProvider from "@/components/session/SessionProvider";
import StationStateProvider from "@/components/stations/StationStateProvider";
import { loadAuth } from "@/lib/api/server";
import { loadLive } from "@/lib/live/load";
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
  const [access, data] = await Promise.all([loadAuth(), loadLive()]);

  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LiveProvider data={data}>
          <SessionProvider access={access}>
            <ClubSettingsProvider>
              <StationStateProvider>
                <BatchStateProvider>
                  <AppShell>{children}</AppShell>
                </BatchStateProvider>
              </StationStateProvider>
            </ClubSettingsProvider>
          </SessionProvider>
        </LiveProvider>
      </body>
    </html>
  );
}
