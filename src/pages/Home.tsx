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

export function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-white">
      {/* Ambiance de fond */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#FFD83D]/8 blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-[#F5A900]/6 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[350px] w-[350px] rounded-full bg-[#ff6b00]/5 blur-[100px]" />
      </div>

      {/* Header sticky */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD83D] to-[#F5A900]">
              <img src="/favicon.svg" alt="" className="h-5 w-5 object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">Amphix Meet</span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-all hover:bg-white/10"
              >
                {user.avatarUrl ? (
  <img
    src={user.avatarUrl}
    alt=""
    className="h-7 w-7 rounded-full object-cover"
  />
) : (
  <span
    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-black"
    style={{ backgroundColor: getAvatarColor(user.id) }}
  >
    {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
  </span>
)}
                <span className="hidden font-medium sm:inline">{user.name}</span>
              </Link>
            )}
            {/* Déconnexion desktop uniquement */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Se déconnecter"
              className="hidden items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300 md:flex"
            >
              <LogOut size={14} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 pb-24 sm:px-6 lg:flex-row lg:gap-12 lg:py-10 lg:pb-10">
        {/* Colonne principale */}
        <div className="flex flex-1 flex-col lg:sticky lg:top-24 lg:self-start">
          <div className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bonjour,{" "}
              <span className="bg-gradient-to-r from-[#FFD83D] to-[#F5A900] bg-clip-text text-transparent">
                {user?.name?.split(" ")[0] ?? "Utilisateur"}
              </span>
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Prêt pour votre prochaine réunion ?
            </p>
          </div>

          {/* Actions rapides */}
          <div className="mb-6 flex gap-2">
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <User size={14} />
              Profil
            </Link>
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all ${
                showHistory
                  ? "border-[#FFD83D]/30 bg-[#FFD83D]/10 text-[#FFD83D]"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <History size={14} />
              Historique
            </button>
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <Settings size={14} />
              Paramètres
            </Link>
          </div>

          {/* Actions principales */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFD83D] to-[#F5A900] px-6 py-4 text-sm font-bold text-[#2B2115] shadow-lg shadow-[#F5A900]/20 transition-all hover:shadow-xl hover:shadow-[#F5A900]/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/15" />
              {isCreating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Plus size={20} />
              )}
              <span>Nouvelle réunion instantanée</span>
              <ArrowRight
                size={18}
                className="ml-auto opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 -translate-x-2"
              />
            </button>

            <button
              type="button"
              onClick={() => setShowBookingModal(true)}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0"
            >
              <CalendarPlus size={20} className="text-[#FFD83D]" />
              <span>Réserver une séance</span>
            </button>

            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Code de réunion"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-[#FFD83D]/40 focus:bg-white/10 focus:ring-2 focus:ring-[#FFD83D]/15"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white/90 transition-all hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
              >
                Rejoindre
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <X size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Colonne secondaire */}
        <div className="w-full lg:max-w-md">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/30">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Chargement de votre espace…</p>
            </div>
          )}

          {!isLoading && !hasSidebarContent && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <Inbox size={28} className="text-white/20" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/60">C'est calme ici</p>
                <p className="mt-1 text-xs text-white/30">
                  Vos réunions et réservations apparaîtront ici.
                </p>
              </div>
            </div>
          )}

          {!isLoading && (
            <div className="space-y-6">
              {pendingReceivedBookings.length > 0 && (
                <Section
                  title="Demandes en attente"
                  icon={<Clock size={14} className="text-amber-400" />}
                  count={pendingReceivedBookings.length}
                >
                  {pendingReceivedBookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {booking.subject}
                          </p>
                          <p className="mt-0.5 text-xs text-white/40">
                            Avec{" "}
                            {booking.teacherId === user?.id
                              ? booking.studentName
                              : booking.teacherName}{" "}
                            · {formatDate(booking.startsAt)}
                          </p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          En attente
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(booking.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/30"
                        >
                          <Check size={13} /> Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition-all hover:bg-white/5 hover:text-white/80"
                        >
                          <X size={13} /> Refuser
                        </button>
                      </div>
                    </li>
                  ))}
                </Section>
              )}

              {upcomingBookings.length > 0 && (
                <Section
                  title="Séances programmées"
                  icon={<CalendarPlus size={14} className="text-[#FFD83D]" />}
                  count={upcomingBookings.length}
                >
                  {upcomingBookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all hover:border-white/10 hover:bg-white/[0.05]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {booking.subject}
                        </p>
                        <p className="mt-0.5 text-xs text-white/40">
                          Avec{" "}
                          {booking.teacherId === user?.id
                            ? booking.studentName
                            : booking.teacherName}{" "}
                          · {formatDate(booking.startsAt)}
                        </p>
                        {booking.status === "PENDING" && (
                          <span className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            En attente
                          </span>
                        )}
                      </div>
                      {booking.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => handleStartBooking(booking.id)}
                          className="flex-shrink-0 rounded-xl bg-gradient-to-r from-[#FFD83D] to-[#F5A900] px-4 py-2 text-xs font-bold text-[#2B2115] shadow-lg shadow-[#F5A900]/20 transition-all hover:shadow-xl hover:shadow-[#F5A900]/30 hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Rejoindre
                        </button>
                      )}
                    </li>
                  ))}
                </Section>
              )}

              {activeMeetings.length > 0 && (
                <Section
                  title="En cours"
                  icon={<Video size={14} className="text-emerald-400" />}
                  count={activeMeetings.length}
                >
                  {activeMeetings.map((meeting) => (
                    <li
                      key={meeting.meetingId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {meeting.title}
                          </p>
                          <p className="text-xs text-white/40">
                            {meeting.isHost ? "Vous êtes l'hôte" : `Par ${meeting.hostName}`} ·{" "}
                            {formatDate(meeting.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/room/${meeting.joinCode}`)}
                        className="flex-shrink-0 rounded-xl bg-gradient-to-r from-[#FFD83D] to-[#F5A900] px-4 py-2 text-xs font-bold text-[#2B2115] shadow-lg shadow-[#F5A900]/20 transition-all hover:shadow-xl hover:shadow-[#F5A900]/30 hover:-translate-y-0.5 active:translate-y-0"
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
                  icon={<CheckCircle2 size={14} className="text-white/30" />}
                >
                  {pastMeetings.slice(0, 5).map((meeting) => (
                    <li
                      key={meeting.meetingId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/70">
                          {meeting.title}
                        </p>
                        <p className="text-xs text-white/25">
                          {meeting.isHost ? "Vous êtes l'hôte" : `Par ${meeting.hostName}`} ·{" "}
                          {formatDate(meeting.createdAt)}
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30">
                        Terminée
                      </span>
                    </li>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer mobile — déconnexion rouge */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              showHistory ? "text-[#FFD83D]" : "text-white/40"
            }`}
          >
            <History size={20} />
            Historique
          </button>
          <Link
            to="/profile"
            className="flex flex-col items-center gap-1 text-[10px] font-medium text-white/40 transition-colors hover:text-white/70"
          >
            <User size={20} />
            Profil
          </Link>
          <Link
            to="/settings"
            className="flex flex-col items-center gap-1 text-[10px] font-medium text-white/40 transition-colors hover:text-white/70"
          >
            <Settings size={20} />
            Paramètres
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-[10px] font-medium text-red-400 transition-colors hover:text-red-300"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </div>

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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {title}
          </span>
        </div>
        {count !== undefined && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
            {count}
          </span>
        )}
      </div>
      <ul className="space-y-2">{children}</ul>
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