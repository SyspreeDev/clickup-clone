import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        // Every card-level shadow carries the same inset top highlight — a thin
        // line of light along the upper edge, which is what makes a flat-fill
        // panel read as "glassy"/lit rather than a plain rectangle. Baking it
        // into the token (rather than layering a second shadow utility at each
        // call site) means it's guaranteed to compose correctly everywhere.
        soft: "inset 0 1px 0 0 rgb(255 255 255 / 0.05), 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 6px -1px rgb(0 0 0 / 0.05), 0 2px 12px -2px rgb(0 0 0 / 0.08)",
        "soft-lg":
          "inset 0 1px 0 0 rgb(255 255 255 / 0.06), 0 2px 8px 0 rgb(0 0 0 / 0.08), 0 8px 24px -4px rgb(0 0 0 / 0.12)",
        glow: "inset 0 1px 0 0 rgb(255 255 255 / 0.06), 0 0 0 1px hsl(var(--primary) / 0.15), 0 4px 20px -2px hsl(var(--primary) / 0.25)",
        /* Neutral ambient depth only — no colored halo. A glow reads as a toy;
           plain elevation reads as sophisticated. For hero panels and cards
           that should feel "lifted" rather than merely bordered. */
        premium:
          "inset 0 1px 0 0 rgb(255 255 255 / 0.06), 0 1px 1px 0 rgb(0 0 0 / 0.16), 0 16px 40px -10px rgb(0 0 0 / 0.45), 0 0 0 1px hsl(var(--border) / 0.7)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
