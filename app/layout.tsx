import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import DemoProvider from "@/components/demo/DemoProvider";
import BatchStateProvider from "@/components/data/BatchStateProvider";
import AppShell from "@/components/layout/AppShell";
import StationStateProvider from "@/components/stations/StationStateProvider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <DemoProvider>
          <StationStateProvider>
            <BatchStateProvider>
              <AppShell>{children}</AppShell>
            </BatchStateProvider>
          </StationStateProvider>
        </DemoProvider>
      </body>
    </html>
  );
}
