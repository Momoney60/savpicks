import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          100: "#F5F6F8",
          200: "#E5E7EB",
          300: "#C9CDD4",
          400: "#8B919C",
          500: "#5B6068",
          600: "#3D4148",
          700: "#282C33",
          800: "#1A1D22",
          850: "#101318",
          900: "#050608",
        },
        brand: {
          DEFAULT: "#7DD3FC",
          50: "#E0F2FE",
          600: "#38BDF8",
          700: "#0EA5E9",
        },
        rink: {
          red: "#EF4444",
          blue: "#7DD3FC",
          gold: "#EAB308",
          ice: "#E0F2FE",
        },
        live: "#EF4444",
        pending: "#EAB308",
        loss: "#EF4444",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
        glow: "0 0 24px rgba(125, 211, 252, 0.45)",
        "glow-red": "0 0 16px rgba(239, 68, 68, 0.35)",
      },
      animation: {
        "live-dot": "live-dot 1.8s ease-in-out infinite",
      },
      keyframes: {
        "live-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
