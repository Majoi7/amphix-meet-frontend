import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  LogOut,
  Loader2,
  Video,
  Clock,
  CheckCircle2,
  CalendarPlus,
  Check,
  X,
  Plus,
  ArrowRight,
  History,
  Settings,
  User,
  Inbox,
  LayoutDashboard,
} from "lucide-react";
import { createMeeting, listMyMeetings, type MeetingListItem } from "../lib/meetingApi";
import {
  listMyBookings,
  confirmBooking,
  cancelBooking,
  startBooking,
  type BookingSummary,
} from "../lib/bookingApi";
import { NewBookingModal } from "../components/NewBookingModal";
import { useAuth } from "../context/AuthContext";
import { getAvatarColor } from "../lib/avatarColor";
import "../styles/theme.css";
import "./home.css";

function Fox() {
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

/* Thème clair/sombre selon le système (comme la landing).
   Si tu as déjà un contexte de thème, remplace ce hook par sa valeur. */
function useSystemTheme(): "light" | "dark" {
  const query = "(prefers-color-scheme: dark)";
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && window.matchMedia(query).matches ? "dark" : "light"
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return theme;
}

export function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const theme = useSystemTheme();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function refreshBookings() {
    listMyBookings()
      .then((res) => setBookings(res.bookings))
      .catch(() => {
        /* silencieux */
      });
  }

  useEffect(() => {
    Promise.all([listMyMeetings(), listMyBookings()])
      .then(([meetingsRes, bookingsRes]) => {
        setMeetings(meetingsRes.meetings);
        setBookings(bookingsRes.bookings);
      })
      .catch(() => {
        /* silencieux */
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleCreateRoom() {
    setIsCreating(true);
    setError(null);
    try {
      const { roomId } = await createMeeting();
      navigate(`/room/${roomId}`);
    } catch {
      setError("Impossible de créer la réunion. Vérifie que le serveur est démarré.");
      setIsCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/room/${code}`);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleConfirmBooking(id: string) {
    try {
      await confirmBooking(id);
      refreshBookings();
    } catch {
      setError("Impossible de confirmer cette réservation.");
    }
  }

  async function handleCancelBooking(id: string) {
    try {
      await cancelBooking(id);
      refreshBookings();
    } catch {
      setError("Impossible d'annuler cette réservation.");
    }
  }

  async function handleStartBooking(id: string) {
    try {
      const { joinCode } = await startBooking(id);
      navigate(`/room/${joinCode}`);
    } catch {
      setError("Impossible de démarrer cette séance.");
    }
  }

  const activeMeetings = meetings.filter((m) => m.status === "IN_PROGRESS");
  const pastMeetings = meetings.filter((m) => m.status === "COMPLETED");

  const pendingReceivedBookings = bookings.filter(
    (b) => b.status === "PENDING" && b.createdById !== user?.id
  );
  const upcomingBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" || (b.status === "PENDING" && b.createdById === user?.id)
  );

  const hasSidebarContent =
    !isLoading &&
    (pendingReceivedBookings.length > 0 ||
      upcomingBookings.length > 0 ||
      activeMeetings.length > 0 ||
      (showHistory && pastMeetings.length > 0));

  return (
    <div className="app-theme hm-root" data-theme={theme}>
      <div className="hm-glow" aria-hidden="true" />

      {/* Header */}
      <header className="hm-header">
        <div className="hm-header-in">
          <Link to="/" className="hm-brand">
            <Fox />
            <span className="hm-brand-name">Amphix Meet</span>
          </Link>

          <div className="hm-right">
            {user && (
              <Link to="/profile" className="hm-chip">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="hm-avatar" />
                ) : (
                  <span
                    className="hm-avatar hm-avatar-fb"
                    style={{ backgroundColor: getAvatarColor(user.id) }}
                  >
                    {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                )}
                <span className="hm-chip-name">{user.name}</span>
              </Link>
            )}

            <Link
              to="/dashboard/admin"
              aria-label="Espace d'administration"
              title="Espace d'administration"
              className="hm-pill"
            >
              <LayoutDashboard size={16} />
              <span className="hm-pill-label">Administration</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Se déconnecter"
              className="hm-logout"
            >
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="hm-main">
        {/* Colonne principale */}
        <div className="hm-col">
          <div className="hm-hello">
            <h2>
              Bonjour,{" "}
              <span className="hm-hello-name">
                {user?.name?.split(" ")[0] ?? "Utilisateur"}
              </span>
            </h2>
            <p className="hm-hello-sub">Prêt pour votre prochaine réunion ?</p>
          </div>

          {/* Actions rapides */}
          <div className="hm-quick">
            <Link to="/profile" className="hm-q">
              <User size={15} />
              Profil
            </Link>
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className={`hm-q${showHistory ? " on" : ""}`}
            >
              <History size={15} />
              Historique
            </button>
            <Link to="/settings" className="hm-q">
              <Settings size={15} />
              Paramètres
            </Link>
          </div>

          {/* Actions principales */}
          <div className="hm-actions">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="hm-btn-primary"
            >
              {isCreating ? <Loader2 size={20} className="hm-spin" /> : <Plus size={20} />}
              <span>Nouvelle réunion instantanée</span>
              <ArrowRight size={18} className="hm-arrow" />
            </button>

            <button
              type="button"
              onClick={() => setShowBookingModal(true)}
              className="hm-btn-secondary"
            >
              <CalendarPlus size={20} />
              <span>Réserver une séance</span>
            </button>

            <form onSubmit={handleJoin} className="hm-join">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Code de réunion"
                className="hm-join-input"
                aria-label="Code de réunion"
              />
              <button type="submit" disabled={!joinCode.trim()} className="hm-join-btn">
                Rejoindre
              </button>
            </form>
          </div>

          {error && (
            <div role="alert" className="hm-error">
              <X size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Colonne secondaire */}
        <div className="hm-side">
          {isLoading && (
            <div className="hm-loading">
              <Loader2 size={28} className="hm-spin" />
              <p>Chargement de votre espace…</p>
            </div>
          )}

          {!isLoading && !hasSidebarContent && (
            <div className="hm-empty">
              <div className="hm-empty-ico">
                <Inbox size={28} />
              </div>
              <div>
                <strong>C'est calme ici</strong>
                <span>Vos réunions et réservations apparaîtront ici.</span>
              </div>
            </div>
          )}

          {!isLoading && (
            <div className="hm-sections">
              {pendingReceivedBookings.length > 0 && (
                <Section
                  title="Demandes en attente"
                  icon={<Clock size={15} className="hm-i-amber" />}
                  count={pendingReceivedBookings.length}
                >
                  {pendingReceivedBookings.map((booking) => (
                    <li key={booking.id} className="hm-item hm-item-pending">
                      <div className="hm-item-top">
                        <div className="hm-item-text">
                          <p className="hm-item-title">{booking.subject}</p>
                          <p className="hm-item-meta">
                            Avec{" "}
                            {booking.teacherId === user?.id
                              ? booking.studentName
                              : booking.teacherName}{" "}
                            · {formatDate(booking.startsAt)}
                          </p>
                        </div>
                        <span className="hm-badge hm-badge-amber">En attente</span>
                      </div>
                      <div className="hm-row">
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(booking.id)}
                          className="hm-act hm-act-ok"
                        >
                          <Check size={14} /> Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking.id)}
                          className="hm-act hm-act-no"
                        >
                          <X size={14} /> Refuser
                        </button>
                      </div>
                    </li>
                  ))}
                </Section>
              )}

              {upcomingBookings.length > 0 && (
                <Section
                  title="Séances programmées"
                  icon={<CalendarPlus size={15} className="hm-i-accent" />}
                  count={upcomingBookings.length}
                >
                  {upcomingBookings.map((booking) => (
                    <li key={booking.id} className="hm-item">
                      <div className="hm-item-text">
                        <p className="hm-item-title hm-trunc">{booking.subject}</p>
                        <p className="hm-item-meta">
                          Avec{" "}
                          {booking.teacherId === user?.id
                            ? booking.studentName
                            : booking.teacherName}{" "}
                          · {formatDate(booking.startsAt)}
                        </p>
                        {booking.status === "PENDING" && (
                          <span className="hm-badge hm-badge-amber hm-badge-block">
                            En attente
                          </span>
                        )}
                      </div>
                      {booking.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => handleStartBooking(booking.id)}
                          className="hm-join-sm"
                        >
                          Rejoindre
                        </button>
                      )}
                    </li>
                  ))}
                </Section>
              )}

              {/* Pas de `count` ici, contrairement aux autres sections : le
                  nombre de réunions en cours est déjà porté par la pastille
                  « En cours » de chaque ligne, et le chiffre seul, posé dans
                  l'en-tête, ne s'expliquait pas. Les autres sections gardent
                  leur compteur, qui reste la seule indication de volume. */}
              {activeMeetings.length > 0 && (
                <Section
                  title="En cours"
                  icon={<Video size={15} className="hm-i-green" />}
                >
                  {activeMeetings.map((meeting) => (
                    <li key={meeting.meetingId} className="hm-item hm-item-live">
                      <div className="hm-item-info">
                        <div className="hm-item-text">
                          {/* L'état vit maintenant DANS la carte, au-dessus du
                              titre, au lieu d'être un contour vert sur toute la
                              carte. `hm-live-dot` (le point qui pulse) est
                              déplacé ici : `aria-hidden` parce que le mot
                              « En cours » juste à côté dit déjà la même chose
                              à un lecteur d'écran. */}
                          <span className="hm-badge hm-badge-green hm-badge-live">
                            <span className="hm-live-dot" aria-hidden="true" />
                            En cours
                          </span>
                          <p className="hm-item-title hm-trunc">{meeting.title}</p>
                          <p className="hm-item-meta">
                            {meeting.isHost ? "Vous êtes l'hôte" : `Par ${meeting.hostName}`} ·{" "}
                            {formatDate(meeting.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/room/${meeting.joinCode}`)}
                        className="hm-join-sm"
                      >
                        Rejoindre
                      </button>
                    </li>
                  ))}
                </Section>
              )}

              {showHistory && pastMeetings.length > 0 && (
                <Section
                  title="Réunions récentes"
                  icon={<CheckCircle2 size={15} className="hm-i-muted" />}
                >
                  {pastMeetings.slice(0, 5).map((meeting) => (
                    <li key={meeting.meetingId} className="hm-item hm-item-past">
                      <div className="hm-item-text">
                        <p className="hm-item-title hm-trunc">{meeting.title}</p>
                        <p className="hm-item-meta">
                          {meeting.isHost ? "Vous êtes l'hôte" : `Par ${meeting.hostName}`} ·{" "}
                          {formatDate(meeting.createdAt)}
                        </p>
                      </div>
                      <span className="hm-badge hm-badge-slate">Terminée</span>
                    </li>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Barre mobile */}
      <nav className="hm-mbar" aria-label="Navigation mobile">
        <div className="hm-mbar-in">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className={`hm-mb${showHistory ? " on" : ""}`}
          >
            <History size={20} />
            Historique
          </button>
          <Link to="/profile" className="hm-mb">
            <User size={20} />
            Profil
          </Link>
          <Link to="/settings" className="hm-mb">
            <Settings size={20} />
            Paramètres
          </Link>
          <button type="button" onClick={handleLogout} className="hm-mb hm-mb-red">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </nav>

      {showBookingModal && (
        <NewBookingModal
          onClose={() => setShowBookingModal(false)}
          onCreated={refreshBookings}
        />
      )}
    </div>
  );
}

/* ─── Sous-composants ─── */

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, icon, count, children }: SectionProps) {
  return (
    <div>
      <div className="hm-section-head">
        <div className="hm-section-title">
          {icon}
          <span>{title}</span>
        </div>
        {count !== undefined && <span className="hm-count">{count}</span>}
      </div>
      <ul className="hm-list">{children}</ul>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}