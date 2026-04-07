import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── DESIGN TOKENS: DONT DREAM. PLAN ──────────────────
      colors: {
        // Paleta Escura — O Mundo do Sonho
        "deep-night": "#0D0D14",
        "stellar-gray": "#1A1A2E",
        surface: "#141420",
        "north-light": "#E8E4DC",
        "muted-silver": "#6B6B80",
        border: "#252538",
        "border-subtle": "#1C1C2C",
        // Paleta de Acento — O Mundo da Execução
        "north-blue": "#4A6FA5",
        "north-blue-dim": "#2E4A72",
        "execute-green": "#2D6A4F",
        "execute-green-dim": "#1A3D2E",
        "pause-amber": "#C9853A",
        "pause-amber-dim": "#7A4F22",
        "archive-mauve": "#7B5EA7",
        "archive-mauve-dim": "#4A3866",
      },
      fontFamily: {
        // Interface + North
        interface: ["var(--font-inter)", "-apple-system", "sans-serif"],
        // Sonhos + Marcos
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.5" }],
        xs: ["13px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.6" }],
        base: ["15px", { lineHeight: "1.6" }],
        lg: ["18px", { lineHeight: "1.5" }],
        xl: ["22px", { lineHeight: "1.4" }],
        "2xl": ["28px", { lineHeight: "1.3" }],
        "3xl": ["36px", { lineHeight: "1.2" }],
        "4xl": ["48px", { lineHeight: "1.1" }],
        "5xl": ["60px", { lineHeight: "1.0" }],
      },
      fontWeight: {
        light: "300",    // North Ouve
        normal: "400",
        medium: "500",   // North Pensa
        semibold: "600", // North Provoca
        bold: "700",
      },
      spacing: {
        // Sistema de 8px
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        full: "9999px",
      },
      transitionDuration: {
        "280": "280ms",
      },
      transitionTimingFunction: {
        "north": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "fade-in": "fadeIn 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slideUp 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        "progress": "progress 600ms ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "typing": "typing 1.2s steps(3) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        progress: {
          "0%": { width: "0%" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        typing: {
          "0%": { content: "''" },
          "33%": { content: "'.'" },
          "66%": { content: "'..'" },
          "100%": { content: "'...'" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "north": "0 4px 24px rgba(13, 13, 20, 0.6)",
        "card": "0 2px 12px rgba(13, 13, 20, 0.4)",
        "blue-glow": "0 0 20px rgba(74, 111, 165, 0.2)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
