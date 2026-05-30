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
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-rev": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
        drift: {
          "0%": { transform: "translateX(-20%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1) translate(0,0)" },
          "100%": { transform: "scale(1.12) translate(-2%,-2%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "bar-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        "marquee-slow": "marquee 60s linear infinite",
        "marquee-rev": "marquee-rev 40s linear infinite",
        drift: "drift 7s linear infinite",
        "ken-burns": "ken-burns 18s ease-in-out infinite alternate",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "spin-slow": "spin-slow 14s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
