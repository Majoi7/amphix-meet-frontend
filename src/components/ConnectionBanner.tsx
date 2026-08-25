import { useNetworkStatus } from "../hooks/useNetworkStatus";

/**
 * Bannière de connectivité Internet — imposante et responsive.
 * Desktop : grande pill flottante centrée.
 * Mobile  : barre pleine largeur en haut avec bordure colorée.
 */
export function ConnectionBanner() {
  const { isOnline, showRestored } = useNetworkStatus();

  // ═════ HORS LIGNE ═════
  if (!isOnline) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] animate-slide-down">
        {/* Mobile : barre pleine largeur */}
        <div className="flex items-center justify-center gap-3 border-t-2 border-red-500/40 bg-[#0a0a0a]/95 px-5 py-4 shadow-2xl backdrop-blur-xl sm:hidden">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse-dot" />
          </span>
          <span className="text-base font-semibold tracking-wide text-white">
            Connexion Internet perdue
          </span>
        </div>

        {/* Desktop : grande pill flottante */}
        <div className="hidden sm:flex sm:justify-center sm:px-6 sm:pt-5">
          <div className="flex items-center gap-4 rounded-full border border-red-500/20 bg-[#0a0a0a]/90 px-10 py-4 shadow-2xl backdrop-blur-xl">
            <span className="relative flex h-6 w-6 items-center justify-center">
              <span className="absolute h-3 w-3 rounded-full bg-red-500 animate-pulse-dot" />
            </span>
            <span className="text-lg font-semibold tracking-wide text-white">
              Connexion Internet perdue
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ═════ RÉTABLIE (toast temporaire) ═════
  if (showRestored) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] animate-slide-down">
        {/* Mobile */}
        <div className="flex items-center justify-center gap-3 border-t-2 border-blue-500/40 bg-[#0a0a0a]/95 px-5 py-4 shadow-2xl backdrop-blur-xl sm:hidden">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-base font-semibold tracking-wide text-white">
            Connexion rétablie
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden sm:flex sm:justify-center sm:px-6 sm:pt-5">
          <div className="flex items-center gap-4 rounded-full border border-blue-500/20 bg-[#0a0a0a]/90 px-10 py-4 shadow-2xl backdrop-blur-xl">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-lg font-semibold tracking-wide text-white">
              Connexion rétablie
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}