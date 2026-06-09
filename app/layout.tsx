import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageBackground } from "@/components/PageBackground";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeToggle } from "@/components/ThemeToggle";

// Runs before paint: applies the persisted theme (or the system preference)
// as a `dark` class on <html> so there is no light-flash on load.
const themeInitScript = `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})();`;

// Self-hosted via next/font so every platform (Windows/Android included)
// renders the same face instead of falling back to Segoe UI/Roboto.
// latin-ext covers the Azerbaijani letters (ə, ı, ş, ğ, ö, ü, ç).
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#16a34a" },
    { media: "(prefers-color-scheme: dark)", color: "#0c120e" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="relative isolate font-sans">
        <PageBackground />
        <div className="relative z-10 min-h-screen">{children}</div>
        <ThemeToggle />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
