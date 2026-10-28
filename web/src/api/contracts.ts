export type Equipment = 'projector' | 'tv' | 'videoConferencing' | 'whiteboard';
export type ReservationStatus = 'Booked' | 'Completed' | 'Cancelled';
export type ReservationAction =
  | 'edit'
  | 'cancel'
  | 'check-in'
  | 'reserve-more'
  | 'end';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: string;
  equipment: Equipment[];
  isActive: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  activeReservationCount: number;
}

export interface Reservation {
  id: string;
  roomId: string;
  roomName: string;
  organizerId: string;
  organizerName: string;
  title: string;
  startUtc: string;
  endUtc: string;
  attendees: number;
  status: ReservationStatus;
  checkedInAtUtc: string | null;
  actualEndUtc: string | null;
  continuationOfId: string | null;
  completionNote: string | null;
  allowedActions: ReservationAction[];
}

export interface RoomAvailability {
  roomId: string;
  isAvailable: boolean;
  reason: string | null;
}

export interface BookingRequest {
  roomId: string;
  organizerId: string;
  title: string;
  startUtc: string;
  endUtc: string;
  attendees: number;
}

export interface ReservationFeed {
  items: Reservation[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface BookingPolicy {
  maximumDurationDays: number;
  maximumAdvanceDays: number;
}

export interface ExtraTimeAvailability {
  maximumMinutes: number;
  startsAtUtc: string;
  blockedFromUtc: string | null;
  blockedUntilUtc: string | null;
  reasonCode: string | null;
  message: string | null;
}

export interface RoomUsage {
  roomId: string;
  roomName: string;
  floor: string;
  isActive: boolean;
  reservationCount: number;
  scheduledMinutes: number;
  elapsedReservedMinutes: number;
  observedMinutes: number;
  unconfirmedMinutes: number;
  releasedMinutes: number;
  unconfirmedCompletedCount: number;
  confirmedSharePercent: number | null;
}

export interface UsageReport {
  fromUtc: string;
  toUtc: string;
  asOfUtc: string;
  measurementSource: string;
  observationNote: string;
  rooms: RoomUsage[];
}

export const equipmentLabels: Record<Equipment, string> = {
  projector: 'Projector',
  tv: 'TV screen',
  videoConferencing: 'Video conferencing',
  whiteboard: 'Whiteboard',
};
