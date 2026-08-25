import { authorizedRequest } from "./httpClient";

export interface CreateMeetingResponse {
  meetingId: string;
  roomId: string; // = joinCode, utilisé dans l'URL /room/:roomId
  title: string;
  roomUrl: string;
  endsAt: string | null;
}

export type JoinMeetingOutcome =
  | { waiting: true; lobbyRequestId: string }
  | {
      waiting: false;
      token: string;
      livekitUrl: string;
      roomId: string;
      role: "HOST" | "PARTICIPANT";
      endsAt: string | null;
    };

export type LobbyStatusOutcome =
  | { status: "PENDING" }
  | { status: "REJECTED" }
  | {
      status: "APPROVED";
      token: string;
      livekitUrl: string;
      roomId: string;
      role: "HOST" | "PARTICIPANT";
      endsAt: string | null;
    };

export interface LobbyRequestItem {
  id: string;
  userId: string;
  name: string;
  requestedAt: string;
}

export interface MeetingInfo {
  meetingId: string;
  joinCode: string;
  title: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isHost: boolean;
  hostName: string;
  endsAt: string | null;
}

export interface MeetingListItem {
  meetingId: string;
  joinCode: string;
  title: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isHost: boolean;
  hostName: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export function listMyMeetings(): Promise<{ meetings: MeetingListItem[] }> {
  return authorizedRequest<{ meetings: MeetingListItem[] }>("/api/v1/meetings/mine", {
    method: "GET",
  });
}

export function createMeeting(
  title?: string,
  requiresApproval?: boolean
): Promise<CreateMeetingResponse> {
  return authorizedRequest<CreateMeetingResponse>("/api/v1/meetings", {
    method: "POST",
    body: JSON.stringify({
      ...(title ? { title } : {}),
      ...(requiresApproval ? { requiresApproval } : {}),
    }),
  });
}

export function getMeeting(joinCode: string): Promise<{ meeting: MeetingInfo }> {
  return authorizedRequest<{ meeting: MeetingInfo }>(`/api/v1/meetings/${joinCode}`, {
    method: "GET",
  });
}

/** Remplace l'ancien fetchToken() de la V1 — plus besoin de passer un nom,
 * il est dérivé du compte authentifié côté serveur. Peut renvoyer
 * waiting=true si la réunion a une salle d'attente activée. */
export function joinMeeting(joinCode: string): Promise<JoinMeetingOutcome> {
  return authorizedRequest<JoinMeetingOutcome>(`/api/v1/meetings/${joinCode}/join`, {
    method: "POST",
  });
}

/** Poll côté demandeur en salle d'attente. */
export function getLobbyStatus(lobbyRequestId: string): Promise<LobbyStatusOutcome> {
  return authorizedRequest<LobbyStatusOutcome>(
    `/api/v1/meetings/lobby-requests/${lobbyRequestId}/status`,
    { method: "GET" }
  );
}

/** Hôte uniquement. */
export function listLobbyRequests(joinCode: string): Promise<{ requests: LobbyRequestItem[] }> {
  return authorizedRequest<{ requests: LobbyRequestItem[] }>(
    `/api/v1/meetings/${joinCode}/lobby`,
    { method: "GET" }
  );
}

export function approveLobbyRequest(lobbyRequestId: string): Promise<void> {
  return authorizedRequest<void>(`/api/v1/meetings/lobby-requests/${lobbyRequestId}/approve`, {
    method: "POST",
  });
}

export function rejectLobbyRequest(lobbyRequestId: string): Promise<void> {
  return authorizedRequest<void>(`/api/v1/meetings/lobby-requests/${lobbyRequestId}/reject`, {
    method: "POST",
  });
}

export function endMeeting(joinCode: string): Promise<void> {
  return authorizedRequest<void>(`/api/v1/meetings/${joinCode}/end`, { method: "POST" });
}

export function muteParticipant(joinCode: string, userId: string): Promise<void> {
  return authorizedRequest<void>(
    `/api/v1/meetings/${joinCode}/participants/${userId}/mute`,
    { method: "POST" }
  );
}

export function removeParticipant(joinCode: string, userId: string): Promise<void> {
  return authorizedRequest<void>(
    `/api/v1/meetings/${joinCode}/participants/${userId}/remove`,
    { method: "POST" }
  );
}
