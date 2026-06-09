import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  // Theme is applied as a `dark` class on <html> by the inline script in
  // app/layout.tsx (localStorage override, falls back to system preference).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // IRF brand (green) — the fund side of the site.
        brand: {
          green: "#16a34a",
          "green-soft": "#22c55e",
          "green-deep": "#15803d",
          "green-mist": "#e9f7ee", // soft tinted backgrounds
          "green-ring": "#bde5ca", // tinted borders / rings
          red: "#dc2626",
        },
        // İsmayılBank brand (blue) — /bank and /ismayilbank area.
        bank: {
          blue: "#2f61d8",
          "blue-deep": "#2854be", // hover / pressed
          "blue-soft": "#eef2fb", // soft tinted backgrounds
          "blue-ring": "#b6cdfe", // tinted borders / rings
        },
        // Payment / schedule statuses (bank loan rows, debt notices).
        status: {
          paid: "#15803d",
          late: "#c74252",
          "late-soft": "#fdecee",
          warn: "#b45309",
        },
        // Primary text color for headings and emphasized copy.
        ink: "#111111",
      },
      borderRadius: {
        card: "1.25rem", // standard tiles & inner panels
        hero: "2rem", // large feature cards / page shells
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glass:
          "0 8px 30px -12px rgba(0,0,0,0.12), inset 0 1px 0 0 rgba(255,255,255,0.7)",
        "glass-green":
          "0 8px 32px rgba(22, 163, 74, 0.10), inset 0 1px 0 0 rgba(255,255,255,0.7)",
      },
      backgroundImage: {
        "page-gradient":
          "linear-gradient(135deg, #ffffff 0%, #f4fdf7 50%, #e8faee 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
