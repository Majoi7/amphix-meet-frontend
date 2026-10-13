/**
 * La marque Amphix — le renard.
 *
 * Extraite de `pages/Home.tsx`, où elle était définie localement sous le nom
 * `Fox`. Le dessin est repris À L'IDENTIQUE : mêmes tracés, même `viewBox`,
 * aucune retouche. C'est la marque du produit, pas un élément d'interface —
 * deux variantes qui divergeraient finiraient par se voir.
 *
 * `Home.tsx` n'est PAS modifié par ce lot et garde sa copie locale. La
 * duplication est assumée : élargir le diff à une page que le brief ne demande
 * pas de toucher aurait été une modification non sollicitée, pour un gain de
 * trois lignes. `Home.tsx` pourra pointer ici le jour où quelqu'un y touchera.
 *
 * LE DESSIN TIENT SUR LES DEUX FONDS. Le renard se peint en
 * `--app-accent-strong` et laisse des TROUS BLANCS — les yeux, l'écran. Sur le
 * fond lavande de l'accueil, ces trous se lisent comme du blanc ; sur le fond
 * blanc pur du pré-join, ils se lisent comme du vide. Dans les deux cas la
 * silhouette reste lisible : la marque n'a donc pas besoin d'une variante par
 * fond, et c'est précisément pourquoi elle est réutilisable telle quelle.
 *
 * `aria-hidden` : le nom « Amphix Meet » est écrit en toutes lettres juste à
 * côté. Faire annoncer le dessin en plus serait une redite.
 */
export function AmphixLogo() {
  return (
    <svg viewBox="70 170 1070 900" aria-hidden="true">
      <g fill="currentColor" style={{ color: "var(--app-accent-strong)" }}>
        <path d="M82 650C150 590 380 560 457 718 400 690 360 690 358 700 362 760 345 780 330 770 300 760 260 745 250 748 245 800 215 840 215 872 230 950 310 1000 388 998 260 1030 180 960 160 830 150 720 140 690 82 660Z" />
        <path d="M370 380C372 350 420 352 480 365 540 378 590 400 620 416 650 398 690 385 714 378 750 290 820 200 870 184 920 200 970 330 978 420 1010 450 1040 490 1052 537L1118 548C1125 555 1110 575 1075 602L1112 610C1090 650 1040 700 982 738 1030 745 1055 780 1052 826 1100 860 1125 910 1120 950 1100 1020 1040 1050 980 1040 940 1030 910 1010 888 990L670 982C660 1010 600 1060 520 1050 470 1040 450 1000 460 940 470 890 510 850 540 836L485 830 512 790 450 795C470 760 490 730 500 712 490 650 495 620 497 622 420 550 372 430 370 380Z" />
      </g>
      <circle cx="652" cy="640" r="95" fill="#fff" />
      <circle cx="881" cy="551" r="95" fill="#fff" />
      <g fill="currentColor" style={{ color: "var(--app-accent-strong)" }}>
        <circle cx="677" cy="625" r="43" />
        <circle cx="904" cy="538" r="43" />
      </g>
      <rect x="612" y="772" width="280" height="210" rx="42" fill="#fff" />
      <rect x="632" y="792" width="240" height="190" rx="26" style={{ fill: "var(--app-accent-strong)" }} />
      <path
        d="M893 825L975 782Q1002 772 1002 800V885L950 925Q950 960 990 985Q985 1000 960 992L893 960Z"
        fill="#fff"
      />
    </svg>
  );
}
