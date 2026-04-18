import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface hierarchy — deep dark with subtle elevation
        ink: {
          900: "#050608",   // page
          850: "#0A0C10",   // card
          800: "#0F1218",   // elevated card
          700: "#171B23",   // border / divider
          600: "#232834",   // muted chip
          500: "#3A4150",   // disabled text
          400: "#6B7280",   // secondary text
          300: "#A0A7B4",   // body text
          200: "#D6DAE2",   // primary text
          100: "#F2F4F8",   // high-contrast text
        },
        // Brand / action
        brand: {
          DEFAULT: "#00E5A8", // electric mint — primary action
          hot: "#00FFB9",
          dim: "#00B388",
        },
        // Semantic
        win: "#00E5A8",
        loss: "#FF3B5C",
        pending: "#FFB020",
        live: "#FF2D55",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },,,
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -10px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(0, 229, 168, 0.2), 0 0 40px -10px rgba(0, 229, 168, 0.5)",
      },
      animation: {
        "pulse-dot": "pulseDot 1.8s ease-in-out infinite",
        "float-up": "floatUp 1.2s ease-out forwards",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.85)" },
        },
        floatUp: {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-120px) scale(1.4)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
