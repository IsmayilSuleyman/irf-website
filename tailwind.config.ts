import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#16a34a",
          "green-soft": "#22c55e",
          "green-deep": "#15803d",
          red: "#dc2626",
        },
      },
      fontFamily: {
        sans: [
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
