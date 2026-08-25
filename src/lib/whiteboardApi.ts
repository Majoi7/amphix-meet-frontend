import { authorizedRequest } from "./httpClient";
import type { WhiteboardData } from "../types/whiteboard";

export function getWhiteboard(joinCode: string): Promise<{ data: WhiteboardData }> {
  return authorizedRequest<{ data: WhiteboardData }>(
    `/api/v1/meetings/${joinCode}/whiteboard`,
    { method: "GET" }
  );
}

export function saveWhiteboard(joinCode: string, data: WhiteboardData): Promise<void> {
  return authorizedRequest<void>(`/api/v1/meetings/${joinCode}/whiteboard`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}
