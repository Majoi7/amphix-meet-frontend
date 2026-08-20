import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface RoomHeaderProps {
  roomId: string;
}

export function RoomHeader({ roomId }: RoomHeaderProps) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="flex h-14 items-center justify-between border-b border-meet-border bg-meet-bg-secondary px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-meet-text-primary">Amphix Meet</span>
        <span className="text-meet-text-disabled">·</span>
        <span className="font-mono text-sm text-meet-text-secondary">{roomId}</span>
      </div>

      <div className="hidden items-center gap-1.5 text-sm text-meet-text-secondary sm:flex">
        <Clock size={14} />
        <span>{formattedTime}</span>
      </div>
    </header>
  );
}
