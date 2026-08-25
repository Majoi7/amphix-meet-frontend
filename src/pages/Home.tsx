import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader2, Video, Clock, CheckCircle2, CalendarPlus, Check, X } from "lucide-react";
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
        /* silencieux — dashboard non bloquant */
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
      pastMeetings.length > 0);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-meet-bg px-4 pb-10 sm:px-6 lg:px-10">
      {/* Ambiance de fond — dégradés doux, purement décoratifs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-meet-blue/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-meet-pink/10 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-meet-green/10 blur-[100px]" />
      </div>

      <div className="flex items-center justify-end gap-3 py-4">
        {user && (
          <span className="animate-fade-in text-sm text-meet-text-secondary">
            Bonjour, <span className="font-medium text-meet-text-primary">{user.name}</span>
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Se déconnecter"
          className="flex items-center gap-1.5 rounded-full border border-meet-border bg-meet-bg-secondary/60 px-3 py-1.5 text-xs text-meet-text-secondary backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-meet-red/40 hover:bg-meet-bg-secondary hover:text-meet-text-primary hover:shadow-glow-red active:translate-y-0"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
        {/* Colonne principale — logo + actions */}
        <div className="flex flex-1 flex-col items-center justify-center py-6 lg:sticky lg:top-10 lg:min-h-[70vh] lg:justify-center lg:py-10">
          <div className="w-full max-w-md animate-slide-up">
            <div className="mb-10 flex items-center justify-center gap-3 lg:justify-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-meet-blue to-meet-pink shadow-glow transition-transform duration-300 ease-fluid hover:rotate-6 hover:scale-105">
                <Video size={24} className="text-white" />
              </div>
              <h1 className="bg-gradient-to-r from-white to-meet-text-secondary bg-clip-text text-2xl font-medium text-transparent">
                Amphix Meet
              </h1>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink bg-[length:200%_100%] bg-left px-6 py-3 text-sm font-medium text-white shadow-glow transition-all duration-300 ease-fluid hover:scale-[1.02] hover:bg-right hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
              >
                {isCreating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Video size={18} className="transition-transform duration-300 group-hover:scale-110" />
                )}
                Nouvelle réunion
              </button>

              <button
                type="button"
                onClick={() => setShowBookingModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-meet-border bg-meet-bg-secondary/40 px-6 py-3 text-sm font-medium text-meet-text-primary backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-meet-blue/50 hover:bg-meet-bg-secondary hover:shadow-glow active:translate-y-0"
              >
                <CalendarPlus size={18} />
                Réserver une séance
              </button>

              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Entrer un code de réunion"
                  className="flex-1 rounded-full border border-meet-border bg-meet-bg-secondary px-5 py-3 text-sm text-meet-text-primary placeholder:text-meet-text-secondary transition-all duration-200 ease-fluid focus:outline-none focus-visible:border-meet-blue focus-visible:shadow-glow focus-visible:ring-2 focus-visible:ring-meet-blue/40"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="rounded-full border border-meet-border px-5 py-3 text-sm font-medium text-meet-text-primary transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-meet-blue/50 hover:bg-meet-bg-secondary disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  Rejoindre
                </button>
              </form>
            </div>

            {error && (
              <p role="alert" className="mt-4 animate-slide-down text-center text-sm text-meet-yellow">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Colonne secondaire — réservations & réunions */}
        <div className="w-full flex-1 lg:max-w-xl lg:pt-10">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-meet-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          )}

          {!isLoading && !hasSidebarContent && (
            <div className="hidden rounded-2xl border border-dashed border-meet-border/70 bg-meet-bg-secondary/30 px-6 py-10 text-center text-sm text-meet-text-secondary lg:block">
              Tes réunions et réservations apparaîtront ici.
            </div>
          )}

          {!isLoading && (
            <div className="space-y-6 pb-6">
              {pendingReceivedBookings.length > 0 && (
                <div className="animate-slide-up">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-meet-text-secondary">
                    <Clock size={14} className="text-meet-yellow" />
                    Demandes en attente de ta confirmation
                  </div>
                  <ul className="space-y-2">
                    {pendingReceivedBookings.map((booking, i) => (
                      <li
                        key={booking.id}
                        style={{ animationDelay: `${i * 60}ms` }}
                        className="animate-scale-in rounded-xl border border-meet-blue/30 bg-gradient-to-br from-meet-blue/10 to-transparent px-4 py-3 backdrop-blur-sm transition-shadow duration-200 hover:shadow-glow"
                      >
                        <p className="text-sm font-medium text-meet-text-primary">
                          {booking.subject}
                        </p>
                        <p className="mb-2 text-xs text-meet-text-secondary">
                          Avec{" "}
                          {booking.teacherId === user?.id
                            ? booking.studentName
                            : booking.teacherName}{" "}
                          · {formatDate(booking.startsAt)}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmBooking(booking.id)}
                            className="flex items-center gap-1 rounded-full bg-meet-green px-3 py-1 text-xs font-medium text-white transition-all duration-200 ease-fluid hover:scale-105 hover:bg-meet-green-hover hover:shadow-glow-green active:scale-95"
                          >
                            <Check size={12} /> Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(booking.id)}
                            className="flex items-center gap-1 rounded-full border border-meet-border px-3 py-1 text-xs font-medium text-meet-text-secondary transition-all duration-200 ease-fluid hover:scale-105 hover:border-meet-red/40 hover:bg-meet-control hover:text-meet-text-primary active:scale-95"
                          >
                            <X size={12} /> Refuser
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {upcomingBookings.length > 0 && (
                <div className="animate-slide-up">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-meet-text-secondary">
                    <CalendarPlus size={14} className="text-meet-blue-soft" />
                    Séances programmées
                  </div>
                  <ul className="space-y-2">
                    {upcomingBookings.map((booking, i) => (
                      <li
                        key={booking.id}
                        style={{ animationDelay: `${i * 60}ms` }}
                        className="animate-scale-in flex items-center justify-between rounded-xl border border-meet-border bg-meet-bg-secondary/60 px-4 py-3 backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-meet-blue/30 hover:shadow-panel"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-meet-text-primary">
                            {booking.subject}
                          </p>
                          <p className="text-xs text-meet-text-secondary">
                            Avec{" "}
                            {booking.teacherId === user?.id
                              ? booking.studentName
                              : booking.teacherName}{" "}
                            · {formatDate(booking.startsAt)}
                            {booking.status === "PENDING" && " · en attente de confirmation"}
                          </p>
                        </div>
                        {booking.status === "CONFIRMED" && (
                          <button
                            type="button"
                            onClick={() => handleStartBooking(booking.id)}
                            className="ml-3 flex-shrink-0 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 ease-fluid hover:scale-105 hover:shadow-glow active:scale-95"
                          >
                            Rejoindre
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeMeetings.length > 0 && (
                <MeetingSection
                  title="En cours"
                  icon={<Clock size={14} className="text-meet-green" />}
                  meetings={activeMeetings}
                  onJoin={(joinCode) => navigate(`/room/${joinCode}`)}
                  pulse
                />
              )}
              {pastMeetings.length > 0 && (
                <MeetingSection
                  title="Réunions récentes"
                  icon={<CheckCircle2 size={14} />}
                  meetings={pastMeetings.slice(0, 5)}
                  onJoin={undefined}
                />
              )}
            </div>
          )}
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

interface MeetingSectionProps {
  title: string;
  icon: React.ReactNode;
  meetings: MeetingListItem[];
  onJoin?: (joinCode: string) => void;
  pulse?: boolean;
}

function MeetingSection({ title, icon, meetings, onJoin, pulse }: MeetingSectionProps) {
  return (
    <div className="animate-slide-up">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-meet-text-secondary">
        {icon}
        {title}
      </div>
      <ul className="space-y-2">
        {meetings.map((meeting, i) => (
          <li
            key={meeting.meetingId}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-scale-in flex items-center justify-between rounded-xl border border-meet-border bg-meet-bg-secondary/60 px-4 py-3 backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-meet-blue/30 hover:shadow-panel"
          >
            <div className="flex min-w-0 items-center gap-2">
              {pulse && (
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-meet-green opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-meet-green" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-meet-text-primary">
                  {meeting.title}
                </p>
                <p className="text-xs text-meet-text-secondary">
                  {meeting.isHost ? "Organisée par vous" : `Par ${meeting.hostName}`} ·{" "}
                  {formatDate(meeting.createdAt)}
                </p>
              </div>
            </div>
            {onJoin && (
              <button
                type="button"
                onClick={() => onJoin(meeting.joinCode)}
                className="ml-3 flex-shrink-0 rounded-full bg-gradient-to-r from-meet-blue to-meet-pink px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 ease-fluid hover:scale-105 hover:shadow-glow active:scale-95"
              >
                Rejoindre
              </button>
            )}
          </li>
        ))}
      </ul>
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