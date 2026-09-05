/**
 * Attribue une couleur d'avatar stable à partir d'un identifiant (userId
 * ou nom) — même personne = toujours la même couleur, personnes
 * différentes = couleurs différentes (dans la limite de la palette).
 * Palette volontairement distincte des couleurs "sémantiques" de
 * l'interface (rouge = erreur/couper, vert = rejoindre) pour ne pas créer
 * de confusion visuelle.
 */
const AVATAR_PALETTE = [
  "#8ab4f8", // bleu clair
  "#c58af9", // violet
  "#78d9ec", // cyan
  "#fdd663", // ambre
  "#f6aea9", // corail
  "#a8dab5", // vert doux
  "#fcad70", // orange
  "#b39ddb", // lavande
  "#ff8a80", // rouge pâle
  "#8bc34a", // vert lime
  "#4fc3f7", // bleu ciel
  "#ce93d8", // lilas
  "#ffb74d", // orange foncé
  "#a1887f", // brun grisâtre
  "#90a4ae", // bleu gris
  "#e57373", // rouge doux
];

export function getAvatarColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}