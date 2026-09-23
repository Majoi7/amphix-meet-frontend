import { getAccessToken, setAccessToken } from "./tokenStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include", // requis pour le cookie httpOnly de refresh token
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiClientError(body?.message ?? `Erreur ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ══════════════════════════════════════════════════════════════════════
   Le renouvellement d'access token, et la fin de session.

   POURQUOI UNE PROMESSE PARTAGÉE, ET NON UN COMPTEUR

   L'access token vit 15 minutes. Une page qui charge trois listes en
   parallèle — c'est le cas de l'administration, qui appelle `meetings/mine`
   et `bookings/mine` dans le même `Promise.allSettled` — envoie donc trois
   requêtes qui reçoivent leur 401 au même instant, et qui déclenchaient
   jusqu'ici trois `POST /auth/refresh` simultanés.

   Ce n'était pas qu'un gaspillage : le refresh token est à ROTATION. Le
   premier appel révoque l'ancien jeton et en émet un nouveau ; les deux
   autres présentaient l'ancien, déjà révoqué, et se voyaient répondre 401.
   La session était donc perdue non pas parce qu'elle était morte, mais
   parce qu'on avait demandé trois fois de suite à la renouveler.

   La correction tient en une variable : la PROMESSE en vol. Le premier
   appelant la crée, tous les suivants la reçoivent telle quelle et
   attendent le même résultat. Il n'y a jamais deux requêtes de
   renouvellement en vie — c'est la seule propriété dont on a besoin, et
   elle s'obtient sans magasin global ni file d'attente.
   ══════════════════════════════════════════════════════════════════════ */

/** La promesse de renouvellement en vol, ou `null`. */
let refreshInFlight: Promise<string> | null = null;

/**
 * Les abonnés à la fin de session — aujourd'hui le seul `AuthContext`.
 *
 * Ce module ne connaît pas React et ne doit pas le connaître : il se
 * contente de DIRE que la session est finie. Qui veut le savoir s'inscrit.
 * Le retour de `onSessionExpired` sert de fonction de nettoyage, ce qui
 * permet de l'utiliser directement comme retour d'un `useEffect`.
 */
const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function announceSessionExpired(): void {
  // Copie avant parcours : un abonné qui se désabonne pendant la
  // notification — un démontage de composant au milieu d'un rendu —
  // modifierait l'ensemble en cours d'itération.
  for (const listener of [...sessionExpiredListeners]) {
    try {
      listener();
    } catch (err) {
      // Un abonné fautif ne doit pas empêcher les autres d'être prévenus,
      // ni transformer une fin de session en exception non capturée.
      console.error("Abonné à la fin de session en échec :", err);
    }
  }
}

/**
 * Renouvelle l'access token. UN SEUL appel en vol, quel que soit le nombre
 * d'appelants — c'est ici que la garantie est tenue, pas chez eux.
 *
 * Ce qui compte comme échec DÉFINITIF : un 401, et lui seul. C'est le seul
 * statut par lequel le serveur dit « cette session n'existe plus »
 * (`missing_refresh_token`, `invalid_refresh_token`). Un 403, un 500 ou une
 * coupure réseau ne disent rien de la session : les prendre pour une
 * déconnexion ferait sortir l'utilisateur parce que le serveur a hoqueté.
 */
function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  // La promesse est construite dans une CONSTANTE locale avant d'être
  // publiée : la variable de module est écrite depuis la fermeture du
  // `finally`, et rendre la valeur par cette variable demanderait au
  // vérificateur de type de suivre une écriture qu'il ne peut pas
  // garantir. Ici, ce qui est publié et ce qui est rendu sont le même
  // objet, sans détour.
  const inFlight = rawRequest<{ accessToken: string }>("/api/v1/auth/refresh", {
    method: "POST",
  })
    .then((res) => {
      setAccessToken(res.accessToken);
      return res.accessToken;
    })
    .catch((err: unknown) => {
      if (err instanceof ApiClientError && err.status === 401) {
        setAccessToken(null);
        announceSessionExpired();
      }
      throw err;
    })
    .finally(() => {
      // Le vol est terminé pour TOUT LE MONDE — la promesse est sur le
      // point d'être rendue à ses appelants. La remettre à `null` ici
      // autorise un prochain renouvellement si un NOUVEAU 401 survient
      // plus tard ; ça ne rouvre pas la boucle, puisque `authorizedRequest`
      // ne retente qu'une fois.
      refreshInFlight = null;
    });

  // Publiée AVANT tout `await` : deux appelants qui arrivent dans la même
  // tranche synchrone voient forcément la même promesse.
  refreshInFlight = inFlight;
  return inFlight;
}

/**
 * Requête authentifiée : attache l'access token en mémoire, et retente
 * UNE fois automatiquement après un refresh silencieux si le serveur
 * répond 401 (access token expiré, durée de vie 15 min).
 *
 * La retentative n'est pas elle-même protégée : si elle reçoit encore un
 * 401, l'erreur remonte à l'appelant sans nouveau renouvellement. C'est ce
 * qui borne la boucle — un seul refresh par requête, quoi qu'il arrive.
 *
 * Un 403, lui, n'est PAS un 401 : il sort immédiatement, sans refresh et
 * sans déconnexion. « Tu n'as pas le droit » n'est pas « tu n'es plus
 * connecté ».
 */
export async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  try {
    return await rawRequest<T>(path, {
      ...options,
      headers: { ...options.headers, Authorization: token ? `Bearer ${token}` : "" },
    });
  } catch (err) {
    if (!(err instanceof ApiClientError) || err.status !== 401) throw err;

    // L'access token a peut-être simplement expiré. Les requêtes
    // concurrentes qui arrivent ici attendent TOUTES la même promesse.
    const renewed = await refreshAccessToken();

    return rawRequest<T>(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${renewed}` },
    });
  }
}
