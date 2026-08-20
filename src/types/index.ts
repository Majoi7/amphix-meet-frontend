export interface CreateRoomResponse {
  roomId: string;
  roomUrl: string;
}

export interface TokenResponse {
  token: string;
  livekitUrl: string;
  roomId: string;
}

export interface DevicePreferences {
  participantName: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}
