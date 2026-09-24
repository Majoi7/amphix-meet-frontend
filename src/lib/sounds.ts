/**
 * Lecture des sons de réunion — un seul point d'entrée.
 *
 * Pourquoi un module plutôt qu'un `new Audio(...)` dispersé :
 *  - une seule politique d'échec (un navigateur peut refuser la lecture tant
 *    qu'aucun geste utilisateur n'a eu lieu ; on l'ignore, jamais d'exception
 *    non gérée) ;
 *  - un préchargement des fichiers pour que le son parte à l'instant de
 *    l'événement, et non après le téléchargement.
 *
 * Un élément `Audio` NEUF est créé à chaque lecture : réutiliser le même
 * objet ferait redémarrer le son en cours au lieu d'en superposer un second,
 * et deux arrivées simultanées ne s'entendraient qu'une fois.
 */

/**
 * Sources des sons de réunion — définies une seule fois.
 *
 * Les littéraux sont regroupés ici pour qu'une même convention de nommage ne
 * puisse pas divergerer entre le fichier qui joue le son et celui qui le
 * précharge.
 */
export const SOUND_ENTREE = "/entree.mp3";
export const SOUND_SORTIE = "/sortie.mp3";
export const SOUND_HAND_RAISE = "/Meet.mp3";

/** Sources déjà préchargées, pour ne pas relancer un fetch à chaque fois. */
const preloaded = new Set<string>();

/**
 * Éléments en cours de lecture.
 *
 * Ils sont retenus jusqu'à la fin du son. Sans cette référence, un son joué
 * juste avant un changement d'écran — le son de sortie, joué à l'instant où
 * l'utilisateur quitte la réunion — pouvait être ramassé par le ramasse-miettes
 * avant d'avoir été entendu.
 */
const playing = new Set<HTMLAudioElement>();

/**
 * Lance le téléchargement d'un son sans le jouer. Appelé au montage pour que
 * le premier événement ne soit pas retardé par le réseau.
 */
export function preloadSound(src: string): void {
  if (preloaded.has(src)) return;
  preloaded.add(src);
  try {
    const audio = new Audio(src);
    audio.preload = "auto";
  } catch {
    // Environnement sans Audio (SSR, test) — sans effet.
  }
}

/**
 * Journalisation de développement.
 *
 * `playSound` avale volontairement ses erreurs : un son manquant ou bloqué ne
 * doit jamais interrompre une réunion. Sans trace, une panne devenait donc
 * indiagnosticable. Ces messages, limités aux builds de développement, rendent
 * l'échec lisible sans rien changer au comportement en production.
 */
const DEV = import.meta.env.DEV;

/**
 * Joue un son, une fois. Les erreurs sont avalées : un son manquant ou bloqué
 * par la politique d'autoplay ne doit jamais perturber la réunion.
 */
export function playSound(src: string): void {
  try {
    const audio = new Audio(src);
    playing.add(audio);

    const release = () => {
      playing.delete(audio);
    };
    audio.addEventListener("ended", release);
    audio.addEventListener("error", release);

    void audio
      .play()
      .then(() => {
        if (DEV) console.log(`[Sound] playing ${src}`);
      })
      .catch((err: unknown) => {
        if (DEV) console.warn(`[Sound] failed ${src}:`, err);
        release();
      });
  } catch (err) {
    // `Audio` indisponible — sans effet sur la réunion.
    if (DEV) console.warn(`[Sound] failed ${src}:`, err);
  }
}
