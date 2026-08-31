/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        meet: {
          bg: "#202124",               // Le vrai fond gris foncé de l'interface Google Meet
          "bg-secondary": "#111b24",   // Le fond du panneau latéral de chat/participants
          tile: "#3c4043",             // Le gris des tuiles vidéo individuelles (quand la caméra est coupée)
          blue: "#0861f0",             // Le bleu Google officiel en mode sombre (boutons actifs)
          "blue-hover": "#0162ff",     
          green: "#81c995",            // Le vert Google officiel en mode sombre
          "green-hover": "#a8dab5",    
          red: "#ea4335",              // Le rouge d'alerte universel Google (bouton raccrocher)
          "red-hover": "#d93025",      
          yellow: "#fdbe00",           // Le jaune Google officiel en mode sombre
          "text-primary": "#e8eaed",   // Le blanc cassé utilisé pour les textes principaux
          "text-secondary": "#9aa0a6", // Le gris moyen pour les sous-titres et icônes secondaires
          "text-disabled": "#5f6368",  // Le gris foncé pour les éléments désactivés
          border: "#3c4043",           // Les bordures fines de séparation
          control: "#3c4043",          // Le fond des boutons ronds de contrôle (micro, caméra)
          "control-hover": "#4a4d51",  // Le survol des boutons de contrôle
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
        tile: "8px",                   // Google Meet utilise majoritairement un arrondi de 8px (md)
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
