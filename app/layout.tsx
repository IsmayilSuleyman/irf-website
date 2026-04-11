import type { Metadata } from "next";
import "./globals.css";
import { PageBackground } from "@/components/PageBackground";

export const metadata: Metadata = {
  title: "İsmayıl Rifah Fondu",
  description: "İsmayıl Rifah Fondu (İRF) sahibləri üçün özəl investor portalı.",
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
      </body>
    </html>
  );
}
