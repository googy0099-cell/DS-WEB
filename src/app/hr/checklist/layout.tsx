import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เช็คลิสต์ | ร้านลูกเต๋า",
  manifest: "/hr/checklist/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "เช็คลิสต์",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function ChecklistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
