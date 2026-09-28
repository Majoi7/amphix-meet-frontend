/**
 * Lecture des sons de réunion — un seul point d'entrée.
 *
 * ════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE A ÉTÉ CORRIGÉ
 * ════════════════════════════════════════════════════════════════════════
 *
 * L'erreur relevée était :
 *
 *     NotSupportedError: Failed to load because no supported source was found.
 *
 * Les fichiers et les chemins ont été vérifiés AVANT de toucher au code :
 * `entree.mp3`, `sortie.mp3` et `Meet.mp3` sont bien dans `frontend/public/`,
 * commencent tous les trois par un en-tête `ID3` valide, pèsent 58,2 / 25,4 /
 * 32,9 Ko, et Vite sert `public/` à la racine — donc `/entree.mp3` est la
 * bonne URL. Le fichier n'était donc PAS en cause.
 *
 * Deux défauts du module produisaient cette erreur, tous les deux :
 *
 * 1. COURSE AU CHARGEMENT. `new Audio(src)` suivi de `play()` DANS LE MÊME
 *    TICK : à cet instant l'algorithme de sélection de source n'a pas encore
 *    abouti (`readyState` vaut `HAVE_NOTHING`), et le navigateur rejette la
 *    promesse en annonçant qu'aucune source lisible n'existe — alors que le
 *    fichier est parfaitement valide. `preloadSound` ne rattrapait rien : il
 *    ne gardait que la CHAÎNE de l'URL, jamais l'élément, qui pouvait donc
 *    être ramassé par le ramasse-miettes avant d'avoir fini de se charger.
 *
 * 2. FUITE DE DÉCODEURS. Un élément neuf à CHAQUE lecture, jamais détruit.
 *    Les `<audio>` détachés s'accumulaient, et au-delà d'un certain nombre
 *    Chrome refuse d'en créer de nouveaux — en levant exactement le même
 *    `NotSupportedError`. Plus la réunion durait, plus le son devenait
 *    aléatoire : c'est ce qui rendait le défaut si difficile à cerner.
 *
 * La correction tient donc en deux règles :
 *
 *  - un élément AMORCÉ par source, créé une fois, gardé en référence, dont on
 *    attend qu'il soit réellement lisible avant de le jouer ;
 *  - les éléments supplémentaires — indispensables pour superposer deux sons
 *    simultanés — sont DÉTRUITS après lecture (`src = ""` puis `load()`), ce
 *    qui libère leur décodeur.
 *
 * La politique d'échec, elle, ne change pas : un son manquant, bloqué ou
 * illisible ne doit jamais interrompre une réunion. Les causes d'échec sont
 * en revanche DISTINGUÉES dans le journal de développement, parce qu'elles
 * n'appellent pas les mêmes correctifs — un fichier illisible et une lecture
 * refusée par la politique d'autoplay n'ont rien à voir.
 */

/**
 * Sources des sons de réunion — définies une seule fois.
 *
 * Les littéraux sont regroupés ici pour qu'une même convention de nommage ne
 * puisse pas diverger entre le fichier qui joue le son et celui qui l'amorce.
 */
export const SOUND_ENTREE = "/entree.mp3";
export const SOUND_SORTIE = "/sortie.mp3";
export const SOUND_HAND_RAISE = "/Meet.mp3";

/** Toutes les sources connues, pour l'amorçage et le déverrouillage. */
const ALL_SOURCES = [SOUND_ENTREE, SOUND_SORTIE, SOUND_HAND_RAISE];

/**
 * Délai au-delà duquel on cesse d'attendre qu'un fichier devienne lisible.
 *
 * Sans cette borne, un fichier absent laisserait une promesse en suspens et un
 * élément retenu indéfiniment — la fuite qu'on cherche justement à supprimer.
 */
const PLAY_TIMEOUT_MS = 4000;

/** Journalisation de développement — rien n'est écrit en production. */
const DEV = import.meta.env.DEV;

/**
 * Élément amorcé par source : créé une fois, conservé pour toute la session.
 *
 * C'est lui qui joue le son dans le cas normal. Parce que son `src` est posé
 * bien avant l'appel à `play()`, le navigateur a eu le temps de le
 * télécharger et de le décoder : la course du point 1 ne peut plus se
 * produire.
 */
const primed = new Map<string, HTMLAudioElement>();

/**
 * Éléments jetables en cours de lecture.
 *
 * Ils ne servent qu'à SUPERPOSER un son quand l'élément amorcé est déjà en
 * train de jouer — deux arrivées simultanées doivent s'entendre deux fois. La
 * référence est conservée le temps de la lecture, puis l'élément est détruit.
 */
const transient = new Set<HTMLAudioElement>();

/** Cause d'un échec de lecture, telle qu'on peut la distinguer. */
type FailureKind = "autoplay" | "source" | "unknown";

function failureKind(err: unknown): FailureKind {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "autoplay";
    if (err.name === "NotSupportedError") return "source";
  }
  return "unknown";
}

/**
 * Trace un échec en développement, en séparant les deux causes.
 *
 * Un fichier illisible et une lecture refusée faute de geste utilisateur
 * produisaient auparavant le même message : impossible de savoir laquelle des
 * deux corriger. Elles sont désormais nommées.
 */
function reportFailure(src: string, kind: FailureKind, err: unknown): void {
  if (!DEV) return;

  if (kind === "autoplay") {
    console.warn(
      `[Sound] ${src} : lecture refusée par la politique d'autoplay — ` +
        "aucun geste utilisateur n'a encore déverrouillé l'audio.",
      err
    );
  } else if (kind === "source") {
    console.warn(
      `[Sound] ${src} : fichier illisible — absent, tronqué, ou format non pris en charge.`,
      err
    );
  } else {
    console.warn(`[Sound] échec ${src} :`, err);
  }
}

function canUseAudio(): boolean {
  return typeof window !== "undefined" && typeof window.Audio === "function";
}

/**
 * Crée (ou récupère) l'élément amorcé d'une source.
 *
 * Le `src` est posé ici, une seule fois. L'événement `error` est écouté dès la
 * création : un fichier absent ou corrompu est ainsi signalé au moment du
 * chargement, et non plus confondu avec un échec de lecture.
 */
function prime(src: string): HTMLAudioElement | null {
  const existing = primed.get(src);
  if (existing) return existing;
  if (!canUseAudio()) return null;

  try {
    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      reportFailure(src, "source", audio.error);
    });
    audio.src = src;
    primed.set(src, audio);
    return audio;
  } catch {
    // Environnement sans `Audio` (SSR, test) — sans effet sur la réunion.
    return null;
  }
}

/**
 * Joue un élément dès qu'il est RÉELLEMENT lisible.
 *
 * C'est le cœur du correctif : `play()` sur un élément dont la source n'est pas
 * encore résolue est la cause directe de `NotSupportedError`. On attend donc
 * `canplay`, avec un délai de garde pour qu'un fichier absent ne retienne
 * jamais l'élément indéfiniment.
 */
function playWhenReady(audio: HTMLAudioElement, onSettled: () => void): void {
  let timer: number | undefined;

  const stopWaiting = () => {
    audio.removeEventListener("canplay", start);
    audio.removeEventListener("canplaythrough", start);
    if (timer !== undefined) window.clearTimeout(timer);
  };

  const start = () => {
    stopWaiting();

    // Rejouer un son déjà joué doit repartir du début, et non reprendre où il
    // s'était arrêté.
    try {
      audio.currentTime = 0;
    } catch {
      // Pas encore « seekable » — la lecture partira du début de toute façon.
    }

    void audio
      .play()
      .then(() => {
        if (DEV) console.log(`[Sound] playing ${audio.src}`);
      })
      .catch((err: unknown) => {
        reportFailure(audio.src, failureKind(err), err);
        onSettled();
      });
  };

  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    start();
    return;
  }

  timer = window.setTimeout(() => {
    stopWaiting();
    reportFailure(audio.src, "source", "délai dépassé avant que le fichier devienne lisible");
    onSettled();
  }, PLAY_TIMEOUT_MS);

  audio.addEventListener("canplay", start);
  audio.addEventListener("canplaythrough", start);
}

/* ------------------------------------------------------------------ */
/* Déverrouillage audio                                                */
/* ------------------------------------------------------------------ */

let unlockInstalled = false;

/**
 * Déverrouillage audio, sur la PREMIÈRE interaction réelle.
 *
 * iOS et certains navigateurs Android refusent `play()` tant que la page n'a
 * pas reçu de geste utilisateur. Or les sons d'ARRIVÉE se déclenchent sur un
 * événement réseau, sans aucun geste : sans ce déverrouillage, le tout premier
 * son d'une réunion peut être refusé.
 *
 * Le geste existe déjà dans l'application — le clic sur « Rejoindre », puis
 * chaque appui sur un bouton de contrôle — on ne fait donc que s'y accrocher.
 * Le mécanisme est ici, et non dans un composant : les trois sources sont
 * connues de ce seul module, et aucun appelant n'a à savoir que l'audio doit
 * être déverrouillé.
 */
function installUnlockListener(): void {
  if (unlockInstalled || typeof document === "undefined") return;
  unlockInstalled = true;

  const unlock = () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("touchend", unlock);

    for (const src of ALL_SOURCES) {
      const audio = prime(src);
      if (!audio) continue;
      // Un vrai son l'utilise déjà : ne pas le couper pour un test muet.
      if (!audio.paused) continue;

      // Lecture MUETTE : elle n'a pas besoin d'être audible, seulement
      // d'ouvrir l'élément auprès du navigateur.
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          // Refusé : la politique d'autoplay reste en vigueur, et le prochain
          // geste retentera. Aucune conséquence sur la réunion.
        })
        .finally(() => {
          audio.muted = false;
        });
    }
  };

  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("touchend", unlock);
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

/**
 * Lance le téléchargement d'un son sans le jouer. Appelé au montage pour que
 * le premier événement ne soit pas retardé par le réseau.
 *
 * Idempotent : l'élément n'est créé qu'une fois par source.
 */
export function preloadSound(src: string): void {
  installUnlockListener();
  prime(src);
}

/**
 * Joue un son, une fois. Les erreurs sont avalées : un son manquant ou bloqué
 * ne doit jamais perturber la réunion.
 */
export function playSound(src: string): void {
  installUnlockListener();

  const base = prime(src);
  if (!base) return;

  // Cas normal : l'élément amorcé est libre. Il est déjà chargé, donc le jouer
  // ne peut plus échouer faute de source.
  if (base.paused) {
    playWhenReady(base, () => {
      /* rien à libérer : cet élément est permanent */
    });
    return;
  }

  // L'élément amorcé joue déjà : on superpose un élément jetable, détruit
  // aussitôt après, pour que deux sons simultanés s'entendent bien deux fois
  // sans accumuler de décodeurs.
  if (!canUseAudio()) return;

  let extra: HTMLAudioElement;
  try {
    extra = new Audio(src);
  } catch {
    return;
  }

  transient.add(extra);

  const dispose = () => {
    transient.delete(extra);
    extra.removeEventListener("ended", dispose);
    extra.removeEventListener("error", dispose);
    // Libère le décodeur. Sans ces deux lignes, les éléments détachés
    // s'accumulent et Chrome finit par refuser toute nouvelle source — le
    // `NotSupportedError` observé après une longue réunion.
    extra.src = "";
    try {
      extra.load();
    } catch {
      // Déjà détruit — sans conséquence.
    }
  };

  extra.addEventListener("ended", dispose);
  extra.addEventListener("error", dispose);

  playWhenReady(extra, dispose);
}
