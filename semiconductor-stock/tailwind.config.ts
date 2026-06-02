import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#f7f4ec",
        accent: "#1d4ed8",
        buy: "#15803d",
        warn: "#b45309",
      },
    },
  },
  plugins: [],
};

export default config;
