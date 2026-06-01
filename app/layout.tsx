import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PageBackground } from "@/components/PageBackground";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "İsmayıl Rifah Fondu",
  description: "İsmayıl Rifah Fondu (İRF) sahibləri üçün özəl investor portalı.",
  appleWebApp: {
    capable: true,
    title: "IRF",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#18A957",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body className="relative isolate">
        <PageBackground />
        <div className="relative z-10 min-h-screen">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
