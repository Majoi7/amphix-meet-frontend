/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
     colors: {
  meet: {
    bg: "#0f1115",              // Plus noir
    "bg-secondary": "#1a1c20",   // Plus foncé
    tile: "#2d1b4e",            // ← BLEU FONCÉ pour les tuiles (comme sur ta capture)
    blue: "#7c3aed",            // Bleu Google
    "blue-hover": "#1765ca",
    green: "#34a853",
    "green-hover": "#2b8a45",
    red: "#ea4335",             // ← VRAI ROUGE pour quitter
    "red-hover": "#c5221f",
    yellow: "#fbbc04",
    "text-primary": "#ffffff",  // Blanc pur
    "text-secondary": "#9aa0a6",
    "text-disabled": "#5f6368",
    border: "#3c4043",
    control: "#3c4043",
    "control-hover": "#5f6368",
  },
},
      fontFamily: {
        sans: [
          "Google Sans",
          "Roboto",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        tile: "12px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
      },
    },
  },
  plugins: [],
};
