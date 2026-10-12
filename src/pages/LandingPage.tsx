import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { createMeeting, joinMeeting, type CreateMeetingResponse } from "../lib/meetingApi";
import { PresentationVideo } from "../components/PresentationVideo";
import "../styles/landingPage.css";

const NAV_LINKS = [
  { href: "#fonctions", label: "Fonctionnalités" },
  { href: "#etapes", label: "Comment ça marche" },
  { href: "#rejoindre", label: "Rejoindre" },
];

// Les liens du menu pilule et du menu mobile partagent les mêmes cibles
const ALL_HREFS = [...NAV_LINKS, ...NAV_LINKS].map((l) => l.href);

const delay = (d: string) => ({ "--d": d }) as CSSProperties;

// Défini hors du composant : sinon il serait recréé à chaque rendu (toast, scroll…)
// et les animations de la mascotte repartiraient de zéro.
// Exporté pour la page 404, qui réutilise la marque telle quelle
// (`components/FoxMascot.tsx`) : le balisage ci-dessous n'est pas modifié, et
// la landing rend donc exactement comme avant.
export function FoxSVG() {
  return (
    <svg viewBox="70 170 1070 900" aria-hidden="true">
      <g fill="currentColor" style={{ color: "var(--ind)" }}>
        <path
          className="tail"
          d="M82 650C150 590 380 560 457 718 400 690 360 690 358 700 362 760 345 780 330 770 300 760 260 745 250 748 245 800 215 840 215 872 230 950 310 1000 388 998 260 1030 180 960 160 830 150 720 140 690 82 660Z"
        />
        <path d="M370 380C372 350 420 352 480 365 540 378 590 400 620 416 650 398 690 385 714 378 750 290 820 200 870 184 920 200 970 330 978 420 1010 450 1040 490 1052 537L1118 548C1125 555 1110 575 1075 602L1112 610C1090 650 1040 700 982 738 1030 745 1055 780 1052 826 1100 860 1125 910 1120 950 1100 1020 1040 1050 980 1040 940 1030 910 1010 888 990L670 982C660 1010 600 1060 520 1050 470 1040 450 1000 460 940 470 890 510 850 540 836L485 830 512 790 450 795C470 760 490 730 500 712 490 650 495 620 497 622 420 550 372 430 370 380Z" />
      </g>
      <circle cx="652" cy="640" r="95" fill="#fff" />
      <circle cx="881" cy="551" r="95" fill="#fff" />
      <g className="pu" fill="currentColor" style={{ color: "var(--ind)" }}>
        <circle cx="677" cy="625" r="43" />
        <circle cx="904" cy="538" r="43" />
      </g>
      <rect x="612" y="772" width="280" height="210" rx="42" fill="#fff" />
      <rect x="632" y="792" width="240" height="190" rx="26" style={{ fill: "var(--ind)" }} />
      <path
        d="M893 825L975 782Q1002 772 1002 800V885L950 925Q950 960 990 985Q985 1000 960 992L893 960Z"
        fill="#fff"
      />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Visio HD",
    text: "Vidéo et audio clairs. Activez ou coupez micro et caméra en un clic.",
    d: "0s",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="2.5" y="6" width="13" height="12" rx="3" />
        <path d="M16 11l5.5-3v8L16 13z" />
      </svg>
    ),
  },
  {
    title: "Partage d’écran",
    text: "Présentez un écran ou une fenêtre, adapté à toutes les tailles d’écran.",
    d: "0.08s",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4M9 10l3-3 3 3M12 7v6" />
      </svg>
    ),
  },
  {
    title: "Chat et participants",
    text: "Échangez par messages et consultez la liste des personnes présentes.",
    d: "0.16s",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
    ),
  },
  {
    title: "Tableau blanc",
    text: "Dessinez, ajoutez des formes et expliquez vos idées en direct.",
    d: "0.24s",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: "Créez votre compte",
    text: "Inscrivez-vous et choisissez votre rôle : étudiant ou enseignant.",
    d: "0s",
  },
  {
    title: "Ouvrez une salle",
    text: "Lancez une réunion et partagez le code avec vos participants.",
    d: "0.1s",
  },
  {
    title: "Collaborez",
    text: "Parlez, partagez votre écran, écrivez dans le chat et dessinez ensemble.",
    d: "0.2s",
  },
];

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolved } = useTheme();

  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  const glowRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLDivElement>(null);

  // Équivalent du <script> du <head> : active les styles de révélation (.js .rv)
  // avant la première peinture pour éviter tout flash de contenu.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("js");
    // Isole la landing du CSS global de l'app (fond du body, reset Tailwind, hauteur de #root)
    document.body.classList.add("landing-page");
    const previousTitle = document.title;
    document.title = "Amphix Meet — Visioconférence moderne";
    return () => {
      html.classList.remove("js");
      document.body.classList.remove("landing-page");
      document.title = previousTitle;
    };
  }, []);

  // Le thème de l'application pilote aussi la landing.
  //
  // `landingPage.css` range ses jetons sur `:root`, et son thème sombre
  // FORCÉ s'écrit `:root[data-theme="dark"]` : l'attribut doit donc être
  // posé sur `documentElement`, et non sur un élément enfant — un
  // `data-theme` sur la `<div>` racine ne serait lu par aucune de ces
  // règles, qui visent toutes `:root`.
  //
  // C'est la seule route qui touche `<html>`, et elle le fait exactement
  // comme pour la classe `js` juste au-dessus : dans un effet, avec un
  // nettoyage symétrique. L'attribut disparaît donc en quittant la landing,
  // et la règle de repli `:root:not([data-theme="light"])` reprend la main
  // si la préférence est restée sur « système ».
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", resolved);
    return () => {
      html.removeAttribute("data-theme");
    };
  }, [resolved]);

  // Redirection si l'utilisateur est connecté (logique d'origine conservée)
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  // Menu mobile : touche Échap + passage en affichage large
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const mq = window.matchMedia("(min-width:901px)");
    const onMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onMediaChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onMediaChange);
    };
  }, []);

  // Effets liés au scroll (navbar, halo, vidéo, lien actif)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    let ticking = false;
    let raf = 0;

    const onScroll = () => {
      const y = window.scrollY;
      setStuck(y > 10);

      if (!reduce) {
        if (glowRef.current) {
          glowRef.current.style.transform = `translate(-50%,${y * 0.18}px)`;
        }
        if (vidRef.current) {
          const r = vidRef.current.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, (window.innerHeight - r.top) / (window.innerHeight * 0.75)));
          vidRef.current.style.transform = `scale(${0.92 + 0.08 * p})`;
        }
      }

      let cur = -1;
      ALL_HREFS.forEach((href, i) => {
        const el = document.querySelector(href);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = i;
      });
      setActiveHref(cur >= 0 ? ALL_HREFS[cur] : null);

      ticking = false;
    };

    const onScrollThrottled = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(onScroll);
      }
    };

    window.addEventListener("scroll", onScrollThrottled, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScrollThrottled);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Apparition au scroll + halo et inclinaison 3D des cartes
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));

    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const cleanups: Array<() => void> = [];

    if (window.matchMedia("(hover:hover)").matches && !reduce) {
      document.querySelectorAll<HTMLElement>(".f, .st").forEach((c) => {
        const onMove = (e: PointerEvent) => {
          const r = c.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          c.style.setProperty("--mx", x + "px");
          c.style.setProperty("--my", y + "px");
          c.style.setProperty("--ry", ((x / r.width - 0.5) * 7).toFixed(2) + "deg");
          c.style.setProperty("--rx", ((0.5 - y / r.height) * 7).toFixed(2) + "deg");
        };
        const onLeave = () => {
          c.style.setProperty("--rx", "0deg");
          c.style.setProperty("--ry", "0deg");
        };
        c.addEventListener("pointermove", onMove);
        c.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          c.removeEventListener("pointermove", onMove);
          c.removeEventListener("pointerleave", onLeave);
        });
      });
    }

    return () => {
      io.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, []);



  const handleActionClick = async (e: MouseEvent<HTMLElement>) => {
    const action = e.currentTarget.dataset.act;

    if (action === "login") {
      e.preventDefault(); // Prevent default anchor behavior
      navigate("/login", { replace: true });
    } else if (action === "start" || action === "join") {
      if (!user) {
        // User not authenticated, redirect to login
        navigate("/login", { replace: true });
        return;
      }

      if (action === "start") {
        try {
          const meeting: CreateMeetingResponse = await createMeeting();
          navigate(`/room/${meeting.roomId}`, { replace: true });
        } catch (err) {
          // Show error message for meeting creation failure
          alert("Erreur lors de la création de la réunion. Veuillez réessayer.");
          navigate("/login", { replace: true });
        }
      } else if (action === "join") {
        const code = prompt("Entrez le code de la réunion");
        if (code === null) {
          // User cancelled the prompt
          return;
        }
        if (!code || !code.trim()) {
          // Empty code
          alert("Veuillez entrer un code de réunion valide.");
          return;
        }
        try {
          await joinMeeting(code.trim());
          navigate(`/room/${code.trim()}`, { replace: true });
        } catch (err) {
          // Show error message for join failure
          alert("Code de réunion invalide ou réunion inexistante. Veuillez vérifier le code et réessayer.");
        }
      }
    }
  };

  const linkClass = (href: string) => (activeHref === href ? "on" : undefined);

  return (
    <>
      <div className={`navbar${stuck ? " stuck" : ""}${menuOpen ? " open" : ""}`} id="navbar">
        <div className="wrap">
          <nav>
            <a className="logo" href="#">
              <span className="fox">
                <FoxSVG />
              </span>
              Amphix Meet
            </a>
            <div className="pill">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </a>
              ))}
            </div>
            <div className="right">
              <a className="btn o" href="/login" data-act="login" onClick={handleActionClick}>
                Se connecter
              </a>
              <button
                className="burger"
                id="burger"
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={menuOpen}
                aria-controls="mnav"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </nav>
          <div className="mnav" id="mnav">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className={linkClass(l.href)} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap">
        <header className="hero">
          <div className="hero-glow" id="glow" ref={glowRef}></div>

          <h1 className="rv">
            Réunissez-vous, apprenez et collaborez avec{" "}
            <span className="fx">
              <FoxSVG />
            </span>
            <mark>Amphix Meet</mark>
          </h1>
          <p className="lead rv" style={delay(".08s")}>
            Réunions en ligne, cours à distance et sessions de travail en temps réel, avec partage d’écran, chat
            intégré et tableau blanc interactif.
          </p>
          <div className="cta rv" id="rejoindre" style={delay(".16s")}>
            <button className="btn p" data-act="start" onClick={handleActionClick}>
              Démarrer une réunion
            </button>
            <button className="btn s" data-act="join" onClick={handleActionClick}>
              Rejoindre avec un code
            </button>
          </div>

          <div className="video-wrap rv" style={delay(".24s")}>
            <div className="vid" id="vid" ref={vidRef}>
              <PresentationVideo />
            </div>
          </div>
        </header>

        <section className="sec" id="fonctions">
          <h2 className="rv">Tout ce qu’il faut pour une réunion réussie</h2>
          <p className="sub rv" style={delay(".06s")}>
            Quatre outils réunis dans une seule salle, sans rien installer.
          </p>
          <div className="feat">
            {FEATURES.map((f) => (
              <div key={f.title} className="f rv" style={delay(f.d)}>
                <div className="ico">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec" id="etapes">
          <h2 className="rv">Prêt en trois étapes</h2>
          <p className="sub rv" style={delay(".06s")}>
            Du compte à la salle de réunion en quelques minutes.
          </p>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.title} className="st rv" style={delay(s.d)}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="band rv">
            <h2>Votre prochaine réunion commence ici.</h2>
            <button className="btn" data-act="start" onClick={handleActionClick}>
              Démarrer une réunion
            </button>
          </div>
        </section>

        <footer>
          <span className="logo" style={{ fontSize: "17px" }}>
            <span className="fox">
              <FoxSVG />
            </span>
            Amphix Meet
          </span>
          <span>© 2026 Amphix Meet. Tous droits réservés.</span>
        </footer>
      </div>
    </>
  );
}