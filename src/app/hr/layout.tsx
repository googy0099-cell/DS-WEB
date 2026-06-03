import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "HR เช็คอิน | ร้านลูกเต๋า",
  manifest: "/hr/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HR เช็คอิน",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#182a47",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#182a47] text-[#f8f1e5]">
      {children}
    </div>
  );
}
