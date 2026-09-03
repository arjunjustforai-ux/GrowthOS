import type { Config } from "tailwindcss";

/**
 * GrowthOS design tokens.
 *
 * Warm ivory ground, deep navy type, one blue accent and one muted amber.
 * Enterprise software that a founder will read on a projector — high contrast,
 * generous type, no gradients, no glow.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: "#FDFCF9",
          100: "#FAF7F1",
          200: "#F4EFE5",
          300: "#EBE4D6",
        },
        navy: {
          50: "#F2F4F8",
          100: "#DDE3EC",
          200: "#B7C2D4",
          300: "#8494AE",
          400: "#556784",
          500: "#33455F",
          600: "#22344B",
          700: "#16253A",
          800: "#0F1B2D",
          900: "#0A1220",
        },
        accent: {
          50: "#EEF3FE",
          100: "#DAE4FC",
          200: "#B4C8F8",
          300: "#829FF0",
          400: "#4F73E3",
          500: "#2B51CE",
          600: "#1F3EAB",
          700: "#1B3288",
          800: "#172A6D",
        },
        amber: {
          50: "#FDF7EA",
          100: "#F8EBCC",
          200: "#EFD79B",
          300: "#DFB960",
          400: "#C9992F",
          500: "#A87B1C",
          600: "#835E13",
        },
        success: { 50: "#EDF7F2", 200: "#A9D8C2", 500: "#1F7A5C", 700: "#155943" },
        danger: { 50: "#FCF0EE", 200: "#F0BDB4", 500: "#B3402F", 700: "#8A2E20" },
        line: {
          DEFAULT: "#E6DFD2",
          strong: "#D6CCB9",
          soft: "#F0EAE0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 27, 45, 0.04), 0 8px 24px -16px rgba(15, 27, 45, 0.18)",
        lift: "0 2px 4px rgba(15, 27, 45, 0.05), 0 18px 40px -22px rgba(15, 27, 45, 0.3)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      borderRadius: {
        card: "14px",
        pill: "999px",
      },
      maxWidth: {
        prose: "68ch",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.2, 0.6, 0.2, 1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
