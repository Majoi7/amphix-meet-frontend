import { InviteButton } from "./InviteButton";
import { SessionTimer } from "./SessionTimer";

interface RoomHeaderProps {
  roomId: string;
  endsAt: string | null;
}

export function RoomHeader({ roomId, endsAt }: RoomHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-meet-border bg-meet-bg-secondary px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-meet-text-primary">Amphix Meet</span>
        <span className="text-meet-text-disabled">·</span>
        <span className="font-mono text-sm text-meet-text-secondary">{roomId}</span>
      </div>

      <div className="flex items-center gap-3">
        <SessionTimer endsAt={endsAt} />
        <InviteButton roomId={roomId} />
      </div>
    </header>
  );
}
