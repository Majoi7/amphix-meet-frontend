import { useEffect, useRef, useState } from "react";

/**
 * La vidéo de présentation du hero de la landing.
 *
 * ELLE CHERCHE D'ABORD LE FICHIER LOCAL, ET SE RABAT SUR YOUTUBE TOUTE SEULE.
 *
 * Pourquoi ce repli existe : `public/video.mp4` n'est pas dans le dépôt, donc
 * `vite build` ne le copie pas dans `dist/` et la production ne le sert pas.
 * Le hero affichait alors un rectangle noir — et pas une erreur franche, ce
 * qui rendait la panne difficile à lire. C'est justement le cas que ce
 * composant rend visible et utilisable.
 *
 * POURQUOI ON ÉCOUTE `error` ET NON UN CODE HTTP. Le site est servi par Vercel
 * avec une réécriture SPA (`/(.*)` → `/index.html`, voir `vercel.json`) : un
 * fichier statique absent ne renvoie donc PAS 404, mais `index.html` en 200
 * avec `Content-Type: text/html`. Impossible de se fier au statut. Le média,
 * lui, reçoit un document HTML qu'il ne peut pas décoder et émet un
 * événement `error` — c'est le seul signal fiable, et il couvre les trois cas
 * du brief : fichier absent, inaccessible, ou illisible.
 *
 * POURQUOI `src` SUR LE `<video>` ET NON UN `<source>`. Avec un `<source>`
 * imbriqué, l'événement `error` se déclenche sur le `<source>`, pas sur le
 * `<video>` : il faudrait poser l'écouteur là, et la moindre source
 * supplémentaire compliquerait la logique. Avec `src` directement sur
 * l'élément, `onError` se déclenche de façon fiable. Le comportement est
 * identique — `controls`, `playsInline`, `preload` et l'`aria-label` d'origine
 * sont conservés.
 */

/** La vidéo locale, servie depuis `public/`. */
const LOCAL_SRC = "/video.mp4";

/** La vidéo de secours, en mode de confidentialité renforcée (sans cookie). */
const YOUTUBE_ID = "y9hIHUPVgg4";
const YOUTUBE_EMBED = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?rel=0&playsinline=1`;
const YOUTUBE_WATCH = `https://youtu.be/${YOUTUBE_ID}`;

/**
 * Délai au-delà duquel on considère que l'iframe n'a pas pu se charger.
 *
 * Une iframe inter-origine ne dit jamais POURQUOI elle a échoué : si le domaine
 * est bloqué par le réseau, aucun événement n'arrive. Le chargement réussi, lui,
 * est signalé par `onLoad`. On guette donc l'absence de ce signal. Le délai est
 * généreux à dessein : mieux vaut laisser une chance au lecteur sur une
 * connexion lente que de basculer à tort vers le lien de secours.
 */
const EMBED_TIMEOUT_MS = 8000;

type Stage = "local" | "youtube" | "unavailable";

export function PresentationVideo() {
  const [stage, setStage] = useState<Stage>("local");
  const timerRef = useRef<number | null>(null);

  // Surveillé seulement quand l'iframe est à l'écran : le minuteur est posé au
  // montage de celle-ci, et retiré dès qu'on la quitte — y compris au
  // démontage de la page.
  useEffect(() => {
    if (stage !== "youtube") return;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setStage("unavailable");
    }, EMBED_TIMEOUT_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stage]);

  // Le lecteur a répondu : le repli n'a plus lieu d'être.
  const handleEmbedLoad = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  if (stage === "local") {
    return (
      <video
        src={LOCAL_SRC}
        controls
        playsInline
        preload="metadata"
        aria-label="Vidéo de présentation d’Amphix Meet"
        onError={() => setStage("youtube")}
      >
        Votre navigateur ne prend pas en charge la lecture vidéo.
      </video>
    );
  }

  if (stage === "youtube") {
    // `autoplay` figure dans la liste des permissions, comme dans l'extrait
    // d'intégration officiel de YouTube : il AUTORISE une lecture automatique,
    // il ne la déclenche pas. Aucun `autoplay=1` n'est passé dans l'URL, donc
    // la vidéo ne démarre pas seule et le son reste sous le contrôle de
    // l'utilisateur.
    return (
      <iframe
        src={YOUTUBE_EMBED}
        title="Vidéo de présentation d’Amphix Meet"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleEmbedLoad}
      />
    );
  }

  return (
    <div className="vid-fallback">
      <p>La vidéo de présentation n’a pas pu être chargée.</p>
      <a href={YOUTUBE_WATCH} target="_blank" rel="noopener noreferrer">
        Regarder la vidéo sur YouTube
      </a>
    </div>
  );
}
