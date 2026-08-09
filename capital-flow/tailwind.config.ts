import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0b0f14",
          panel: "#121820",
          border: "#1e2a38",
          muted: "#8b9bb0",
          text: "#e8eef6",
          red: "#e11d48",
          blue: "#2563eb",
          accent: "#f59e0b",
          green: "#22c55e",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
