import type { Config } from "tailwindcss";

/**
 * Tokens de DESIGN.md como fuente de verdad.
 * Los colores se resuelven vía CSS vars (ver app/globals.css) para
 * soportar dark mode por prefers-color-scheme y por [data-theme].
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        border: "var(--color-border)",
        input: "var(--color-border)",
        ring: "var(--color-ring)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-on-primary)",
          hover: "var(--color-primary-hover)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-on-secondary)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-on-accent)",
        },
        success: "var(--color-success)",
        header: {
          DEFAULT: "var(--color-header)",
          foreground: "var(--color-on-header)",
          muted: "var(--color-header-muted)",
        },
        whatsapp: {
          DEFAULT: "var(--color-whatsapp)",
          foreground: "var(--color-on-whatsapp)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-on-destructive)",
        },
      },
      borderRadius: {
        input: "var(--radius-input)",
        card: "var(--radius-card)",
        pill: "9999px",
      },
      fontFamily: {
        heading: ["var(--font-rubik)", "system-ui", "sans-serif"],
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Escala mobile-first de DESIGN.md
        meta: ["0.8125rem", { lineHeight: "1.15rem" }], // 13px
        base: ["1rem", { lineHeight: "1.5rem" }], // 16px
        h3: ["1.125rem", { lineHeight: "1.6rem" }], // 18px
        h2: ["1.375rem", { lineHeight: "1.85rem" }], // 22px
        h1: ["1.75rem", { lineHeight: "2.1rem" }], // 28px
        display: ["2rem", { lineHeight: "2.35rem" }], // 32px+
      },
      boxShadow: {
        // Una sola escala de elevación (DESIGN.md).
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
      },
      spacing: {
        // Escala de 4px explícita para los gaps grandes de landing.
        18: "4.5rem",
      },
      transitionTimingFunction: {
        "ease-out-soft": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
