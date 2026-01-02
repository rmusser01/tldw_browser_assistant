/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        surface2: "var(--color-surface-2)",
        elevated: "var(--color-elevated)",
        primary: "var(--color-primary)",
        primaryStrong: "var(--color-primary-strong)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warn: "var(--color-warn)",
        danger: "var(--color-danger)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        borderStrong: "var(--color-border-strong)",
        "border-strong": "var(--color-border-strong)",
        text: "var(--color-text)",
        textMuted: "var(--color-text-muted)",
        "text-muted": "var(--color-text-muted)",
        textSubtle: "var(--color-text-subtle)",
        "text-subtle": "var(--color-text-subtle)",
        focus: "var(--color-focus)"
      },
      fontFamily: {
        display: ["Space Grotesk", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        arimo: ["Arimo", "sans-serif"]
      },
      fontSize: {
        body: ["14px", { lineHeight: "20px" }],
        message: ["15px", { lineHeight: "22px" }],
        caption: ["12px", { lineHeight: "16px" }],
        label: ["11px", { lineHeight: "14px", letterSpacing: "0.04em" }]
      },
      borderRadius: {
        card: "12px",
        pill: "9999px"
      },
      boxShadow: {
        card: "0 6px 18px rgba(0,0,0,0.16)",
        modal: "0 10px 30px rgba(0,0,0,0.28)"
      },
      backgroundImage: {
        'bottom-mask-light': 'linear-gradient(0deg, transparent 0, #ffffff 160px)',
        'bottom-mask-dark': 'linear-gradient(0deg, transparent 0, #171717 160px)',
      },
      maskImage: {
        'bottom-fade': 'linear-gradient(0deg, transparent 0, #000 160px)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' }
        }
      },
      animation: {
        shake: 'shake 0.3s ease-in-out'
      }
    }
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")]
}
