import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types";
import { ROLE_LABEL } from "./lib/derive";
import { Notice } from "./components/Notice";

/**
 * Réserve une route d'administration à un rôle.
 *
 * CE N'EST PAS UNE PROTECTION, ET IL FAUT LE DIRE
 *
 * Cette garde vit dans le navigateur : elle décide de ce qui est AFFICHÉ,
 * pas de ce qui est PERMIS. Un utilisateur qui la contourne n'obtient rien
 * de plus, parce qu'il n'y a rien derrière — l'API ne comporte aucun point
 * d'entrée d'administration, et le serveur n'accorde aucune donnée de
 * plateforme à un jeton utilisateur. La classification des sept vues, dans
 * `App.tsx`, dit laquelle est concernée et pourquoi.
 *
 * C'est précisément pour cela qu'aucune API n'a été créée pour « justifier »
 * cette garde : elle ferme un écran, pas une porte. Ce qu'elle apporte est
 * réel mais plus modeste — ne pas mettre sous les yeux de tout le monde une
 * page dont le sujet est l'infrastructure de la plateforme.
 *
 * POURQUOI ELLE LIT LE RÔLE DU CLIENT
 *
 * `AuthUser.role` vient de `GET /auth/me`, donc du serveur : ce n'est pas
 * une valeur que le navigateur choisit, seulement une qu'il affiche. Le
 * rôle est la seule information nécessaire ici, et elle est déjà chargée —
 * interroger le serveur une seconde fois pour la même réponse n'ajouterait
 * qu'une requête et un état de chargement.
 *
 * LE REFUS EST UNE PAGE, PAS UNE REDIRECTION
 *
 * Renvoyer vers le tableau de bord sans rien dire donnerait l'impression
 * d'un lien mort, ou d'une panne. Le refus s'affiche donc là où la page
 * aurait été, dans la coquille d'administration — barre latérale et
 * navigation intactes —, et il nomme le rôle attendu ainsi que celui du
 * compte connecté : c'est ce qui distingue « ce n'est pas pour vous » de
 * « votre session a un problème ».
 *
 * Ce composant se monte SOUS `RequireAuth` (la route parente `/dashboard`
 * l'applique déjà), donc l'état « session en cours de vérification » ne lui
 * parvient pas : `RequireAuth` a rendu son indicateur avant. Il reste
 * néanmoins correct monté seul — un utilisateur absent n'est pas du rôle
 * demandé —, ce qui évite d'en faire un composant qui n'a le droit
 * d'exister qu'à un seul endroit de l'arbre.
 */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return (
      <Notice tone="warning" title={`Accès réservé aux ${ROLE_LABEL[role].toLowerCase()}s`}>
        <p>
          Cette page décrit les accès programmatiques de la plateforme. Votre compte a le
          rôle «&nbsp;{user ? ROLE_LABEL[user.role] : "inconnu"}&nbsp;».
        </p>
        <p className="mt-2">
          <Link
            to="/dashboard"
            className="font-semibold underline underline-offset-2"
            style={{ color: "var(--dash-red)" }}
          >
            Retour au tableau de bord
          </Link>
        </p>
      </Notice>
    );
  }

  return <>{children}</>;
}
