import type { Metadata, Viewport } from "next";
import { CopilotVisibility } from "@/components/CopilotVisibility";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frontier AI App Factory",
  description: "Plan, build, preview, and export your next app.",
  applicationName: "Frontier AI App Factory",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Frontier" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <CopilotVisibility />
      </body>
    </html>
  );
}
