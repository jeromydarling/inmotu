import type { Config } from "tailwindcss";

/**
 * inmotu design system
 * --------------------
 * Aesthetic: carbon-black paddock at dusk. High-contrast, technical, fast.
 * Race-orange is the "live / go" signal; amber is the qualifying ladder;
 * green is "advanced / saved". Type pairs a condensed display face (Archivo)
 * with Inter for UI text.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carbon: {
          950: "#07080B",
          900: "#0A0C11",
          850: "#0E1117",
          800: "#13161E",
          700: "#1B1F2A",
          600: "#262B38",
          500: "#363C4D",
        },
        ignition: {
          DEFAULT: "#FF4D14",
          50: "#FFF1EC",
          100: "#FFDfd3",
          300: "#FF8A5C",
          400: "#FF6A33",
          500: "#FF4D14",
          600: "#E63A05",
          700: "#B82D03",
        },
        amber: {
          DEFAULT: "#FFB800",
          400: "#FFC633",
          500: "#FFB800",
          600: "#D99B00",
        },
        flag: {
          green: "#27D17F",
          red: "#FF3B4E",
        },
      },
      fontFamily: {
        display: ['"Archivo"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(255,77,20,0.12), transparent 60%)",
        "checker":
          "repeating-conic-gradient(#13161E 0% 25%, #0A0C11 0% 50%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,77,20,0.4), 0 8px 40px -8px rgba(255,77,20,0.35)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
