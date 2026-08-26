import type { MetadataRoute } from "next";

// Makes the site an installable PWA (Add to Home Screen) with a standalone
// app window + icon. Next links this automatically at /manifest.webmanifest.
//
// No true Android home-screen widget exists for PWAs — that needs an APK —
// so this leans on everything the installed web app CAN do: a dark splash
// (no white flash on launch), app-icon badge counts (sw.js), push banners,
// and long-press icon shortcuts straight into the app's areas.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "İsmayıl Rifah Fondu",
    short_name: "İRF",
    description: "İsmayıl Rifah Fondu — investisiya portfeli və İsmayılBank",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Launch/splash in the app's dark ground — the old #ffffff flashed a
    // white frame before the dark UI painted.
    background_color: "#0b0f0d",
    theme_color: "#0b0f0d",
    lang: "az",
    categories: ["finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon → jump straight in. The closest thing
    // to a widget the web platform offers on Android.
    shortcuts: [
      {
        name: "Portfel",
        short_name: "Portfel",
        description: "Şəxsi portfel və fond görünüşü",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "İsmayılBank",
        short_name: "Bank",
        description: "Depozit, kredit və xatırlatmalar",
        url: "/bank",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Bazar",
        short_name: "Bazar",
        description: "Pay alqı-satqısı",
        url: "/market",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Xatırlatmalar",
        short_name: "Borclar",
        description: "Digər borcların xatırlatması",
        url: "/bank#xatirlatmalar",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
