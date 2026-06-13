import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { isTestModeActive } from "@/lib/test-mode";
import TestModeControl from "@/components/TestModeControl";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dice Shop",
  description: "ระบบสั่งอาหารและเกม Dice Shop Board Game Cafe",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-512-v2.png", type: "image/png" },
    ],
    apple: "/icon-512-v2.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Dice Shop" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#182a47",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const testMode = await isTestModeActive();
  return (
    <html lang="th" className={`${sarabun.variable} h-full`}>
      <body className={`min-h-full flex flex-col font-sarabun antialiased ${testMode ? "bg-violet-100" : "bg-cream"}`}>
        <SessionProvider>
          <TestModeControl active={testMode} />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
