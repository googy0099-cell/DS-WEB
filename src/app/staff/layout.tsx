import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/admin/RegisterSW";

export const metadata: Metadata = {
  title: "Staff | ร้านลูกเต๋า",
  manifest: "/manifest-staff.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DS Staff",
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

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#182a47] text-[#f8f1e5]">
      <RegisterSW />
      {children}
    </div>
  );
}
