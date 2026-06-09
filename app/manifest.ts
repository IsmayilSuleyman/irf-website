import type { MetadataRoute } from "next";

// Makes the site an installable PWA (Add to Home Screen) with a standalone
// app window + icon. Next links this automatically at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "İsmayıl Rifah Fondu",
    short_name: "IRF",
    description: "İsmayıl Rifah Fondu — investisiya portfeli və İsmayılBank",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
