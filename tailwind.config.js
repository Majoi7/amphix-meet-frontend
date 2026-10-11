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
          pink: "#ff8bcb",             // Le rose Google du thème sombre, pendant de #8ab4f8
        },
      },
      fontFamily: {
        // Pile demandée par le brief : Google Sans, puis Roboto, puis Arial,
        // puis la famille générique. Google Sans est la police de Google Meet
        // et n'est PAS distribuée — absente de Google Fonts comme des
        // dépendances du projet : la première entrée ne se résout sur rien et
        // n'a jamais rien rendu. Elle est conservée pour ne pas retirer une
        // intention existante, mais aucune police n'est téléchargée pour
        // l'occasion. Les pages qui doivent rendre en Figtree la nomment
        // explicitement (`theme.css`, `home.css`, `prejoin.css`,
        // `profile.css`) ; la salle de réunion, elle, est couverte par
        // `index.css`. `Arial` est ajoutée avant la famille générique,
        // conformément à la pile demandée : elle ne prend la main que sur un
        // système sans Roboto ni police d'interface.
        sans: [
          "Google Sans",
          "Roboto",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        tile: "8px",                   // Google Meet utilise majoritairement un arrondi de 8px (md)
      },
      boxShadow: {
        glow: "0 8px 28px -8px rgba(8, 97, 240, 0.55)",  // Halo bleu des actions mises en avant
        panel: "0 24px 60px -24px rgba(0, 0, 0, 0.65)",  // Élévation des cartes posées sur le fond
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.22, 1, 0.36, 1)",         // Départ franc, arrivée posée
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
        // Miroir exact de `slide-up` : les bannières ancrées en haut et les
        // messages d'erreur entrent par le haut plutôt que par le bas.
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Point d'état (« connexion perdue ») : il pulse pour attirer l'œil.
        // Il reste VISIBLE à l'arrêt — voir prefers-reduced-motion (index.css).
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.8)" },
        },
        // Apparition de la vue de soi : elle se pose, elle ne surgit pas.
        "self-view-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.94)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Menus contextuels : un simple décalage, sans mise à l'échelle, pour
        // ne pas dépendre de l'origine du menu (positionné en JavaScript).
        "menu-pop": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "slide-down": "slide-down 200ms ease-out",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "self-view-in": "self-view-in 220ms ease-out",
        "menu-pop": "menu-pop 130ms ease-out",
      },
    },
  },
  plugins: [],
};
