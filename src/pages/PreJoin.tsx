import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DevicePreview } from "../components/DevicePreview";
import { useAuth } from "../context/AuthContext";
import type { DevicePreferences } from "../types";

interface PreJoinProps {
  onJoin: (prefs: DevicePreferences) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

export function PreJoin({ onJoin, isJoining, error }: PreJoinProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deviceState, setDeviceState] = useState({ micEnabled: true, cameraEnabled: true });

  if (!roomId) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onJoin(deviceState);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-[#0a0a0a] px-4 py-8 sm:py-10 lg:flex-row lg:gap-20 lg:px-12">
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-[#FFD83D]/10 blur-[130px] lg:h-[28rem] lg:w-[28rem]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-[#F5A900]/8 blur-[120px] lg:h-96 lg:w-96" />
        <div className="absolute left-1/2 top-1/2 hidden h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff6b00]/5 blur-[140px] lg:block" />
      </div>

      <div className="w-full max-w-md animate-scale-in lg:max-w-lg">
        <DevicePreview
  displayName={user?.name ?? ""}
  avatarUrl={user?.avatarUrl ?? undefined}
  identity={user?.id ?? ""}
  onDeviceStateChange={setDeviceState}
/>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-slide-up rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl backdrop-blur-xl sm:p-6 lg:max-w-md lg:p-8"
      >
        <div className="mb-5 flex items-center gap-2 sm:mb-6 lg:mb-8 lg:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFD83D]/10 lg:size-10">
            <img src="/favicon.svg" alt="" className="h-5 w-5 object-contain" />
          </span>
          <span className="text-sm text-white/50 lg:text-base">
            Prêt à rejoindre{" "}
            <span className="break-all rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-white/80">
              {roomId}
            </span>{" "}
            ?
          </span>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 lg:mb-6 lg:p-4">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover lg:size-9"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD83D] to-[#F5A900] text-xs font-bold text-[#2B2115] lg:size-9">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
          <p className="truncate text-sm text-white/50">
            Connecté en tant que{" "}
            <span className="font-medium text-white/90">{user?.name}</span>
          </p>
        </div>

        <button
          type="submit"
          disabled={isJoining}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD83D] to-[#F5A900] px-6 py-3 text-sm font-bold text-[#2B2115] shadow-lg shadow-[#F5A900]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#F5A900]/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:scale-100 lg:py-3.5 lg:text-base"
        >
          {isJoining && <Loader2 size={18} className="animate-spin" />}
          Rejoindre
        </button>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}