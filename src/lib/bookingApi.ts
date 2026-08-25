import { authorizedRequest } from "./httpClient";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface BookingSummary {
  id: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: BookingStatus;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  createdById: string;
  meetingJoinCode: string | null;
}

export function createBooking(input: {
  otherPartyEmail: string;
  subject: string;
  startsAt: string; // ISO
  durationMinutes?: number;
}): Promise<{ booking: BookingSummary }> {
  return authorizedRequest<{ booking: BookingSummary }>("/api/v1/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMyBookings(): Promise<{ bookings: BookingSummary[] }> {
  return authorizedRequest<{ bookings: BookingSummary[] }>("/api/v1/bookings/mine", {
    method: "GET",
  });
}

export function confirmBooking(id: string): Promise<{ booking: BookingSummary }> {
  return authorizedRequest<{ booking: BookingSummary }>(`/api/v1/bookings/${id}/confirm`, {
    method: "POST",
  });
}

export function cancelBooking(id: string): Promise<{ booking: BookingSummary }> {
  return authorizedRequest<{ booking: BookingSummary }>(`/api/v1/bookings/${id}/cancel`, {
    method: "POST",
  });
}

export function startBooking(id: string): Promise<{ joinCode: string }> {
  return authorizedRequest<{ joinCode: string }>(`/api/v1/bookings/${id}/start`, {
    method: "POST",
  });
}
